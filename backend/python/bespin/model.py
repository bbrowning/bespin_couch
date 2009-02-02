#  ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
# 
# The contents of this file are subject to the Mozilla Public License  
# Version
# 1.1 (the "License"); you may not use this file except in compliance  
# with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
# 
# Software distributed under the License is distributed on an "AS IS"  
# basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the  
# License
# for the specific language governing rights and limitations under the
# License.
# 
# The Original Code is Bespin.
# 
# The Initial Developer of the Original Code is Mozilla.
# Portions created by the Initial Developer are Copyright (C) 2009
# the Initial Developer. All Rights Reserved.
# 
# Contributor(s):
# 
# ***** END LICENSE BLOCK *****
# 

"""Data classes for working with files/projects/users."""
import os
import time
from cStringIO import StringIO
import hashlib
import tarfile
import tempfile
import zipfile

import pkg_resources
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, PickleType, String, Integer, \
                    Boolean, Binary, Table, ForeignKey
from sqlalchemy.orm import relation, deferred, mapper, backref
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm.exc import NoResultFound

from bespin import config

Base = declarative_base()

class ConflictError(Exception):
    pass
    
class FSException(Exception):
    pass
    
class FileNotFound(FSException):
    pass

class FileConflict(FSException):
    pass

class NotAuthorized(FSException):
    pass
    
class DB(object):
    def __init__(self, user_manager, file_manager):
        self.user_manager = user_manager
        self.file_manager = file_manager
        
        user_manager.db = self
        file_manager.db = self
    
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    username = Column(String(20), unique=True)
    email = Column(String(128))
    password = Column(String(20))
    settings = Column(PickleType())
    private_project = Column(String(50))
    projects = relation('Project', backref='owner')
    
    def __init__(self, username, password, email):
        self.username = username
        self.email = email
        self.password = password
        self.settings = {}
        
        hashobj = hashlib.sha1(config.c.secret + " " + self.password)
        # the NUMBER- at the beginning is the version number of the
        # key. every time we change how we compute the hash, we should
        # increment this number. This will avoid the unlikely
        # collisions.
        self.private_project = "1-" + hashobj.hexdigest()
    

class UserManager(object):
    def __init__(self, session):
        self.session = session
        
    def create_user(self, username, password, email):
        """Adds a new user with the given username and password.
        This raises a ConflictError is the user already
        exists."""
        user = User(username, password, email)
        self.session.add(user)
        # flush to ensure that the user is unique
        try:
            self.session.flush()
        except DBAPIError:
            raise ConflictError("Username %s is already in use" % username)
        self.db.file_manager.install_template(username,
                                username + "_New_Project")
        return user
        
    def get_user(self, username):
        """Looks up a user by username. Returns None if the user is not
        found."""
        return self.session.query(User).filter_by(username=username).first()
            
    def save_user(self, username, user):
        """Saves the user object, replacing any prexisting data.
        create_user should be used for a new user."""
        self.store[username] = user
        
class FileStatus(Base):
    __tablename__ = "filestatus"
    
    user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    file_id = Column(Integer, ForeignKey('files.id'), primary_key=True)
    read_only = Column(Boolean)
    
class File(Base):
    __tablename__ = "files"
    
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)
    data = deferred(Column(Binary))
    dir_id = Column(Integer, ForeignKey('directories.id'))
    dir = relation('Directory', backref="files")
    
    users = relation('User', secondary=FileStatus.__table__, 
                     backref="files")

project_members = Table('members', Base.metadata,
                        Column('project_id', Integer, ForeignKey('projects.id')),
                        Column('user_id', Integer, ForeignKey('users.id')))
    
class Directory(Base):
    __tablename__ = "directories"
    
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)
    parent_id = Column(Integer, ForeignKey('directories.id'))
    subdirs = relation('Directory', backref=backref("parentdir", 
                                        remote_side=[parent_id]))
    
    def __str__(self):
        return "Dir: %s" % (self.name)
    
    __repr__ = __str__
    
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)
    members = relation("User", secondary=project_members, lazy=False)
    user_id = Column(Integer, ForeignKey('users.id'))
    
    def authorize(self, user):
        if user != self.owner and user not in self.members:
            raise NotAuthorized("You are not authorized to access that project.")
            
    def authorize_user(self, user, auth_user):
        """user is requesting to allow auth_user to access this
        project. user must be this project's owner."""
        if user != self.owner:
            raise NotAuthorized("Only the project owner can authorize users.")
        self.members.add(auth_user)
        
    def unauthorize_user(self, user, auth_user):
        """user wants auth_user to no longer be able to access this
        project. user must be the project owner."""
        if user != self.owner:
            raise NotAuthorized("Only the project owner can unauthorize users.")
        try:
            self.members.remove(auth_user)
        except KeyError:
            pass
            
    def __repr__(self):
        return "Project(name=%s)" % (self.name)
    

class FileManager(object):
    def __init__(self, session):
        self.session = session
        
    def get_file(self, user, project_name, path, mode="rw"):
        """Gets the contents of the file as a string. Raises
        FileNotFound if the file does not exist. The file is 
        marked as open after this call."""
        self.get_project(user, project_name)
        full_path = project_name + "/" + path
        fs = self.file_store
        ss = self.status_store
        try:
            obj = fs[full_path]
        except KeyError:
            raise FileNotFound("Path %s does not exist" % full_path)
        if isinstance(obj, Directory):
            raise FSException("Path %s is a directory, not file" % full_path)
            
        file_status = FileStatus.get(ss, full_path)
        file_status.users.add(user)
        file_status.save(ss, full_path)
        
        user_status = UserStatus.get(ss, user)
        try:
            project_files = user_status.files[project_name]
        except KeyError:
            project_files = {}
            user_status.files[project_name] = project_files
        project_files[path] = mode
        user_status.save(ss, user)
        return obj
        
    def list_files(self, user, project_name=None, path=""):
        """Retrieve a list of files at the path. Directories will have
        '/' at the end of the name.
        
        If project_name is None, this will return the projects
        owned by the user."""
        if not project_name:
            user_obj = self.db.user_manager.get_user(user)
            return sorted(project + '/' for project in user_obj.projects)
        self.get_project(user, project_name)
        full_path = project_name + "/" + path
        try:
            dir = self.session.query(Directory).filter_by(name=full_path).one()
        except NoResultFound:
            raise FileNotFound(full_path)
        return sorted(dir.files)
        
    def get_project(self, username, project_name, create=False, clean=False):
        """Retrieves the project object, optionally creating it if it
        doesn't exist. Additionally, this will verify that the
        user is authorized for the project."""
        
        s = self.session
        user = self.db.user_manager.get_user(username)
        
        # a request for a clean project also implies that creating it
        # is okay
        if clean:
            create = True
        
        try:
            project = s.query(Project).filter_by(name=project_name).one()
            project.authorize(user)
            if clean:
                # a clean project has been requested, so we will delete its
                # contents
                self.delete(username, project_name)
        except NoResultFound:
            if not create:
                raise FileNotFound("Project %s not found" % project_name)
            project = Project(name=project_name, owner=user)
            s.add(project)
        return project
        
    def save_file(self, user, project_name, path, contents, last_edit=None):
        """Saves the contents to the file path provided, creating
        directories as needed in between. If last_edit is not provided,
        the file must not be opened for editing. Otherwise, the
        last_edit parameter should include the last edit ID received by
        the user."""
        project = self.get_project(user, project_name, create=True)
        s = self.session
        full_path = project_name + "/" + path
        segments = full_path.split("/")
        fn = segments[-1]
        last_d = None
        # The project object is the root directory of the paths
        # but its name appears in the filename keys. So, the
        # filenames will all have the project name which is
        # why it's in full_path, but we can skip the first part
        # of the path
        for i in range(1, len(segments)):
            segment = "/".join(segments[0:i]) + "/"
            try:
                d = s.query(Directory).filter_by(name=segment).one()
            except NoResultFound:
                d = Directory(name=segment)
                s.add(d)
                if last_d:
                    d.parent = last_d
            last_d = d
        if not last_d:
            raise FSException("Unable to get to path %s from the root" % full_path)
        subdir_names = [item.name for item in last_d.subdirs]
        if (full_path + "/") in subdir_names:
            raise FileConflict("Cannot save a file at %s because there is a directory there." % full_path)
        file = File(name=full_path, dir=last_d, data=contents)
        # self.reset_edits(user, project_name, path)
        
    def list_open(self, user):
        """list open files for the current user. a dictionary of { project: { filename: mode } } will be returned. For example, if subdir1/subdir2/test.py is open read/write, openfiles will return { "subdir1": { "somedir2/test.py": "rw" } }"""
        user_status = UserStatus.get(self.status_store, user)
        return user_status.files
        
    def close(self, user, project, path):
        """Close the file for the given user"""
        ss = self.status_store
        user_status = UserStatus.get(ss, user)
        files = user_status.files
        project_files = files.get(project)
        if project_files:
            try:
                del project_files[path]
            except KeyError:
                pass
            if not project_files:
                del files[project]
        user_status.save(ss, user)
        
        full_path = project + "/" + path
        file_status = FileStatus.get(ss, full_path)
        try:
            file_status.users.remove(user)
        except KeyError:
            pass
        file_status.save(ss, full_path)
        self.reset_edits(user, project, path)
    
    def delete(self, user, project_name, path=""):
        """Deletes a file, as long as it is not opened. If the file is
        open, a FileConflict is raised. If the path is a directory,
        the directory and everything underneath it will be deleted.
        If the path is empty, the project will be deleted."""
        project = self.get_project(user, project_name)
        full_path = project_name + "/" + path
        segments = full_path.split("/")
        fs = self.file_store
        
        if not full_path in fs:
            raise FileNotFound("%s not found" % full_path)
            
        file_status = FileStatus.get(self.status_store, full_path)
        open_users = file_status.users
        if open_users:
            open_by_me = len(open_users) == 1 and user in open_users
            if not open_by_me:
                raise FileConflict("Cannot delete %s because it is in use" % full_path)
            if open_by_me:
                self.close(user, project_name, path)
        
        obj = fs[full_path]
        if full_path.endswith("/"):
            del segments[-1]
            dir_name = "/".join(segments[:-1]) + "/"
            myname = segments[-1] + "/"
            for sub_path in list(obj.files):
                sub_path = path + sub_path
                self.delete(user, project_name, sub_path)
        else:
            dir_name = "/".join(segments[:-1]) + "/"
            myname = segments[-1]
        
        # everything looks good to delete
        del fs[full_path]
        
        # check to see if we're deleting a project
        if not path:
            user_manager = self.db.user_manager
            user_obj = user_manager.get_user(user)
            user_obj.projects.remove(project_name)
            user_manager.save_user(user, user_obj)
            return
            
        # remove the directory entry
        d = fs[dir_name]
        d.files.remove(myname)
        # make sure we save the changes
        fs[dir_name] = d
        
    def save_edit(self, user, project_name, path, edit):
        project = self.get_project(user, project_name, create=True)
        full_path = project_name + "/" + path
        try:
            edits = self.edit_store[full_path]
        except KeyError:
            edits = []
            self.edit_store[full_path] = edits
        edits.append(edit)
        user_status = UserStatus.get(self.status_store, user)
        project_files = user_status.files.setdefault(project_name, {})
        if path not in project_files:
            project_files[path] = 'rw'
            user_status.save(self.status_store, user)
        
    def list_edits(self, user, project_name, path, start_at=0):
        project = self.get_project(user, project_name)
        full_path = project_name + "/" + path
        edits = self.edit_store.get(full_path, [])
        if start_at:
            if start_at >= len(edits):
                raise FSException("%s only has %s edits (after %s requested)"
                    % (full_path, len(edits), start_at))
            edits = edits[start_at:]
        return edits
        
    def reset_edits(self, user, project_name=None, path=None):
        if not project_name or not path:
            user_status = UserStatus.get(self.status_store, user)
            for project_name, project_files in list(user_status.files.items()):
                for path in list(project_files):
                    self.reset_edits(user, project_name, path)
            return
            
        project = self.get_project(user, project_name)
        full_path = project_name + "/" + path
        try:
            del self.edit_store[full_path]
        except KeyError:
            pass
        user_status = UserStatus.get(self.status_store, user)
        project_files = user_status.files.get(project_name)
        if project_files and path in project_files:
            del project_files[path]
            if not project_files:
                del user_status.files[project_name]
            user_status.save(self.status_store, user)
            
    def install_template(self, user, project_name, template="template"):
        project = self.get_project(user, project_name, create=True)
        source_dir = pkg_resources.resource_filename("bespin", template)
        common_path_len = len(source_dir) + 1
        for dirpath, dirnames, filenames in os.walk(source_dir):
            destdir = dirpath[common_path_len:]
            if '.svn' in destdir:
                continue
            for f in filenames:
                if destdir:
                    destpath = "%s/%s" % (destdir, f)
                else:
                    destpath = f
                contents = open(os.path.join(dirpath, f)).read()
                self.save_file(user, project_name, destpath, contents)
                
    def authorize_user(self, user, project_name, auth_user):
        """Allow auth_user to access project_name which is owned by user."""
        project = self.get_project(user, project_name)
        project.authorize_user(user, auth_user)
        self.file_store[project_name] = project
        
    def unauthorize_user(self, user, project_name, auth_user):
        """Disallow auth_user from accessing project_name which is owned
        by user."""
        project = self.get_project(user, project_name)
        project.unauthorize_user(user, auth_user)
        self.file_store[project_name] = project
        
    def import_tarball(self, user, project_name, filename, file_obj):
        """Imports the tarball in the file_obj into the project
        project_name owned by user. If the project already exists,
        IT WILL BE WIPED OUT AND REPLACED."""
        project = self.get_project(user, project_name, clean=True)
        pfile = tarfile.open(filename, fileobj=file_obj)
        max_import_file_size = config.c.max_import_file_size
        info = list(pfile)
        
        base = _find_common_base(member.name for member in info)
        base_len = len(base)
        
        for member in info:
            # save the files, directories are created automatically
            # note that this does not currently support empty directories.
            if member.isreg():
                if member.size > max_import_file_size:
                    raise FSException("File %s too large (max is %s bytes)" 
                        % (member.name, max_import_file_size))
                self.save_file(user, project_name, member.name[base_len:], 
                    pfile.extractfile(member).read())
        
    def import_zipfile(self, user, project_name, filename, file_obj):
        """Imports the zip file in the file_obj into the project
        project_name owned by user. If the project already exists,
        IT WILL BE WIPED OUT AND REPLACED."""
        project = self.get_project(user, project_name, clean=True)
        max_import_file_size = config.c.max_import_file_size
        
        pfile = zipfile.ZipFile(file_obj)
        info = pfile.infolist()
        
        base = _find_common_base(member.filename for member in info)
        base_len = len(base)
        
        for member in pfile.infolist():
            if member.filename.endswith("/"):
                continue
            if member.file_size > max_import_file_size:
                raise FSException("File %s too large (max is %s bytes)" 
                    % (member.filename, max_import_file_size))
            self.save_file(user, project_name, member.filename[base_len:],
                pfile.read(member.filename))
        
    def export_tarball(self, user, project_name):
        """Exports the project as a tarball, returning a 
        NamedTemporaryFile object. You can either use that
        open file handle or use the .name property to get
        at the file."""
        project = self.get_project(user, project_name)
        fs = self.file_store
        temporaryfile = tempfile.NamedTemporaryFile()
        mtime = time.time()
        tfile = tarfile.open(temporaryfile.name, "w:gz")
        def add_to_tarfile(item, path=project_name + "/"):
            next_path = "%s%s" % (path, item)
            obj = fs[next_path]
            if isinstance(obj, Directory):
                tarinfo = tarfile.TarInfo(next_path[:-1])
                tarinfo.type = tarfile.DIRTYPE
                # we don't know the original permissions.
                # we'll default to read/execute for all, write only by user
                tarinfo.mode = 493
                tarinfo.mtime = mtime
                tfile.addfile(tarinfo)
                for f in obj.files:
                    add_to_tarfile(f, next_path)
            else:
                tarinfo = tarfile.TarInfo(next_path)
                tarinfo.mtime = mtime
                # we don't know the original permissions.
                # we'll default to read for all, write only by user
                tarinfo.mode = 420
                tarinfo.size = len(obj)
                fileobj = StringIO(obj)
                tfile.addfile(tarinfo, fileobj)
        add_to_tarfile("")
        tfile.close()
        temporaryfile.seek(0)
        return temporaryfile
        
    def export_zipfile(self, user, project_name):
        """Exports the project as a zip file, returning a 
        NamedTemporaryFile object. You can either use that
        open file handle or use the .name property to get
        at the file."""
        project = self.get_project(user, project_name)
        fs = self.file_store
        temporaryfile = tempfile.NamedTemporaryFile()
        zfile = zipfile.ZipFile(temporaryfile, "w", zipfile.ZIP_DEFLATED)
        ztime = time.gmtime()[:6]
        def add_to_zipfile(item, path=project_name + "/"):
            next_path = "%s%s" % (path, item)
            obj = fs[next_path]
            if isinstance(obj, Directory):
                for f in obj.files:
                    add_to_zipfile(f, next_path)
                return
            zipinfo = zipfile.ZipInfo(next_path)
            # we don't know the original permissions.
            # we'll default to read for all, write only by user
            zipinfo.external_attr = 420 << 16L
            zipinfo.date_time = ztime
            zipinfo.compress_type = zipfile.ZIP_DEFLATED
            zfile.writestr(zipinfo, obj)
        add_to_zipfile("")
        zfile.close()
        temporaryfile.seek(0)
        return temporaryfile
        
def _find_common_base(member_names):
    base = None
    base_len = None
    for name in member_names:
        if base is None:
            slash = name.find("/")
            base = name[:slash+1]
            base_len = len(base)
            continue
        if name[:base_len] != base:
            base = ""
            break
    return base
    
