/* ***** BEGIN LICENSE BLOCK *****
 *
 * TODO: What do I need to put here?
 *
 * ***** END LICENSE BLOCK ***** */

dojo.provide("bespin.client.couchdb");

dojo.extend(bespin.client.Server, {

    // ** {{{ couchdb() }}}
    //
    // Return couchdb object
    couchdb: function() {
        return bespin.get('couchdb') || bespin.register('couchdb', new bespin.client.CouchDB());
    },

    // ** {{{ appdb() }}}
    //
    // Return db object for this couchapp
    appdb: function() {
        var appDbName = document.location.href.split('/').reverse()[3];
        return this.couchdb().db(appDbName);
    },

    userdb: function() {
        var user = dojo.cookie('bespin_couch_user');
        return this.couchdb().db('bespin_user_' + user);
    },

    appDesignDoc: function() {
        var appdbname = this.appdb().name;
        var uriParts = document.location.href.split('/');
        // Remove trailing file (ex: index.html, editor.html)
        uriParts.pop();
        // Remove everything up-to and including the database
        uriParts = uriParts.slice(uriParts.indexOf(appdbname) + 1, uriParts.length);
        return uriParts.join('/');
    },

    // == USER ==

    // ** {{{ encodePassword(pass) }}}
    //
    // Encode the given password
    encodePassword: function(pass) {
        return dojox.encoding.digests.SHA1(pass, dojox.encoding.digests.outputTypes.Hex);
    },

    setLoginCookie: function(user) {
        dojo.cookie('bespin_couch_user', user, {
            expires: 1 / 24, // 1 hour
            path: '/'
        });
    },

    // ** {{{ login(user, pass, token, onSuccess, notloggedin) }}}
    //
    // Try to login to the backend system.
    //
    // * {{{user}}} is the username
    // * {{{pass}}} is the password
    // * {{{onSuccess}}} fires when the user is logged in
    // * {{{onFailure}}} fires when the user failed to login
    login: function(user, pass, onSuccess, onFailure) {
        var encodedPass = this.encodePassword(pass);
        var server = this;
        this.couchdb().db('bespin_user_' + user).openDoc('bespin_account', {}, {
            onSuccess: function(doc) {
                if (doc.password === encodedPass) {
                    server.setLoginCookie(user);
                    onSuccess();
                } else {
                    onFailure({ responseText: 'Bad password' });
                }
            },
            on404: function() {
                onFailure({ responseText: 'Unknown user' });
            },
            onFailure: onFailure
        });
    },

    // ** {{{ signup(user, pass, email, onSuccess, notloggedin, userconflict) }}}
    //
    // Signup / Register the user to the backend system
    //
    // * {{{user}}} is the username
    // * {{{pass}}} is the password
    // * {{{email}}} is the email
    // * {{{onSuccess}}} fires when the user is logged in
    // * {{{notloggedin}}} fires when not logged in
    // * {{{userconflict}}} fires when the username exists
	  signup: function(user, pass, email, onSuccess, notloggedin, userconflict) {
        var server = this;

        var installUserTemplate = function() {
            server.installTemplate(server.userdb(), 'BespinSettings',
                                   'usertemplate', onSuccess);
        };
        var installSampleTemplate = function() {
            server.installTemplate(server.userdb(), 'SampleProject',
                                   'template', installUserTemplate);
        };
        this.couchdb().db('bespin_user_' + user).create({
            onSuccess: function() {
                server.setLoginCookie(user);
                server.userdb().saveDoc({
                    _id: 'bespin_account',
                    username: user,
                    password: server.encodePassword(pass),
                    email: email
                }, {
                    onSuccess: installSampleTemplate
                });
            },
            on412: userconflict,
            onFailure: notloggedin
        });
	  },

    // ** {{{ logout(onSuccess) }}}
    //
    // Logout from the backend
    //
    // * {{{onSuccess}}} fires after the logout attempt
    logout: function(onSuccess) {
        dojo.cookie('bespin_couch_user', 'some_value', {
            expires: -1,
            path: '/'
        });
    },

    // ** {{{ currentuser(onSuccess, notloggedin) }}}
    //
    // Return info on the current logged in user
    //
    // * {{{onSuccess}}} fires after the user attempt
    // * {{{notloggedin}}} fires if the user isn't logged in
    currentuser: function(whenLoggedIn, whenNotloggedin) {
        var user = dojo.cookie('bespin_couch_user');
        if (user === undefined) {
            whenNotloggedin();
        } else {
            this.userdb().openDoc('bespin_account', {}, {
                onSuccess: whenLoggedIn,
                onFailure: whenNotloggedin
            });
        }
    },

    // == FILES ==

    // ** {{{ list(project, path, onSuccess, onFailure) }}}
    //
    // List the path in the given project
    //
    // * {{{project}}} is the project to list
    // * {{{path}}} is the path to list out
    // * {{{onSuccess}}} fires if the list returns something
    // * {{{onFailure}}} fires if there is an error getting a list from the server
    list: function(project, path, onSuccess, onFailure) {
        project = project || '';
        if (project === '') {
            this.userdb().allDocs({
                onSuccess: function(results) {
                    var docs = results.rows.map(function(doc) {
                        return { name: doc.key + "/" };
                    });
                    onSuccess(docs);
                },
                onFailure: onFailure
            });
        } else {
            var pathParts = project.split('/');
            project = pathParts.shift();
            path = pathParts.join('/');
            this.userdb().openDoc(project, {}, {
                onSuccess: function(doc) {
                    var files = [];
                    for (var file in doc._attachments) {
                        files.push(file);
                    }

                    // Strip out path prefix, if given
                    if (path != '') {
                        files = files.filter(function(file) {
                            return file.indexOf(path) > -1;
                        });
                        files = files.map(function(file) {
                            return file.replace(path + '/', '');
                        });

                    }

                    // For files in subdirectories, display just
                    // the directories
                    files = files.map(function(file) {
                        var slashIndex = file.indexOf('/');
                        if (slashIndex > 0) {
                            return file.substring(0, slashIndex + 1);
                        }
                        return file;
                    });

                    onSuccess(files.map(function(file) {
                        return { name: file };
                    }));
                },
                onFailure: onFailure
            });
        }
    },

    // ** {{{ projects(onSuccess) }}}
    //
    // Return the list of projects that you have access too
    //
    // * {{{onSuccess}}} gets fired with the project list
    projects: function(onSuccess) {
        this.list('', '', onSuccess, function() {});
    },

    // ** {{{ loadFile(project, path, contents) }}}
    //
    // Load the given file
    //
    // * {{{project}}} is the project to load from
    // * {{{path}}} is the path to load
    // * {{{onSuccess}}} fires after the file is loaded
    loadFile: function(project, path, onSuccess, onFailure) {
        this.userdb().openAttachment(project, path, {
            onSuccess: onSuccess,
            onFailure: onFailure
        });
    },

    // ** {{{ saveFile(project, path, contents, lastOp) }}}
    //
    // Save the given file
    //
    // * {{{project}}} is the project to save
    // * {{{path}}} is the path to save to
    // * {{{contents}}} fires after the save returns
    // * {{{lastOp}}} contains the last edit operation
    saveFile: function(project, path, contents, lastOp) {
        if (!project || !path) return;

        // TODO: For now this just grabs the latest rev and saves
        // this file. We should probably warn the user if someone else
        // has changed the file? Attachments are revisioned separately though
        // so maybe not.
        var server = this;
        this.userdb().openDoc(project, {}, {
            onSuccess: function(doc) {
                var revision = doc._rev;

                // TODO: New files always get text/plain - need smart library
                // to figure out the content-type
                var contentType = "text/plain";
                if (doc._attachments[path]) {
                    contentType = doc._attachments[path].content_type;
                }

                server.userdb().saveAttachment(project, revision, path, contents, {
                    headers: {
                        'Content-Type': contentType
                    }
                });
            }
        });
    },

    // ** {{{ removeFile(project, path, onSuccess, onFailure) }}}
    //
    // Remove the given file
    //
    // * {{{project}}} is the project to remove from
    // * {{{path}}} is the path to remove
    // * {{{onSuccess}}} fires if the deletion works
    // * {{{onFailure}}} fires if the deletion failed
    removeFile: function(project, path, onSuccess, onFailure) {
        project = project || '';
        path = path || '';
        var server = this;
        this.userdb().openDoc(project, {}, {
            onSuccess: function(doc) {
                var revision = doc._rev;
                server.userdb().removeAttachment(project, revision, path, {
                    onSuccess: onSuccess,
                    onFailure: onFailure
                });
            }
        });
    },

    // ** {{{ processMessages() }}}
    // Starts up message retrieve for this user. Call this only once.
    processMessages: function() {
        // TODO: implement this!
    },

    // ** {{{ installTemplate(db, project, template) }}}
    //
    // Install a template into a project
    //
    // * {{{db}}} the destination db
    // * {{{project}}} the destination project
    // * {{{template}}} the template to copy files from
    installTemplate: function(db, project, template, onSuccess) {
        var server = this;
        this.appdb().openDoc(this.appDesignDoc(), {}, {
            onSuccess: function(doc) {
                var templateFiles = [];
                for (var attachment in doc._attachments) {
                    var attachParts = attachment.split('/');
                    if (attachParts[0] === 'templates' &&
                        attachParts[1] === template) {
                        templateFiles.push({
                            key: attachment,
                            content_type: doc._attachments[attachment].content_type
                        });
                    }
                }
                server.installTemplateFiles(db, project, templateFiles, onSuccess);
            }
        });
    },

    // ** {{{ installTemplateFiles(db, project, files) }}}
    //
    // Install the list of template files into a project
    //
    // * {{{db}}} the destination db
    // * {{{project}}} the destination project
    // * {{{files}}} the list of files to copy
    installTemplateFiles: function(db, project, files, onSuccess) {
        // if the files list is empty, we're done
        if (files.length == 0) {
            onSuccess();
        }

        var server = this;
        var file = files.pop();
        var newFile = file.key.split('/');
        newFile.shift(); // "templates"
        newFile.shift(); // template name
        newFile = newFile.join('/');
        var saveOpts = {
            headers: { 'Content-Type': file.content_type },
            onSuccess: function() {
                // Recursively install the other template files
                // Done recursively instead of iteratively since we're
                // using async requests and need to install the template
                // files in serial to update rev parameters
                server.installTemplateFiles(db, project, files, onSuccess);
            }
        };
        this.appdb().openAttachment(this.appDesignDoc(), file.key, {
            onSuccess: function(attachment) {
                db.openDoc(project, {}, {
                    onSuccess: function(doc) {
                        db.saveAttachment(project, doc._rev, newFile, attachment, saveOpts);
                    },
                    on404: function() {
                        // 404 just means this project doesn't exist yet so create it
                        db.saveAttachment(project, null, newFile, attachment, saveOpts);
                    }
                });
            }
        });
    }

});

// = CouchDB =
//
// A lot of this code is ported from jquery.couch.js shipped with
// CouchDB. Need to add the correct license/copyright attribution.

dojo.declare("bespin.client.CouchDB", null, {
    // ** {{{ initialize() }}}
    //
    // Object creation initialization
    //
    constructor: function() {
        this.server = new bespin.client.Server('../../..');
    },

    db: function(name) {
        return {
            name: name,
            uri: "/" + encodeURIComponent(name) + "/",
            server: this.server,

            create: function(opts) {
                opts = opts || {};
                this.server.request('PUT', this.uri, null, opts);
            },

            drop: function(opts) {
                opts = opts || {};
                this.server.request('DELETE', this.uri, null, opts);
            },

            info: function(opts) {
                opts = opts || {};
                opts.evalJSON = true;
                this.server.request('GET', this.uri, null, opts);
            },

            allDocs: function(opts) {
                opts = opts || {};
                opts.evalJSON = true;
                this.server.request('GET', this.uri + '_all_docs', null, opts);
            },

            openDoc: function(docId, docOpts, opts) {
                docOpts = docOpts || {};
                opts = opts || {};
                var uri = this.uri + encodeURIComponent(docId);
                var encodedOptions = dojo.objectToQuery(docOpts);
                if (encodedOptions.length > 0) uri += "?" + encodedOptions;

                opts.evalJSON = true;
                this.server.request('GET', uri, null, opts);
            },

            saveDoc: function(doc, opts) {
                opts = opts || {};
                var method = 'POST';
                var uri = this.uri;
                if (doc._id != undefined) {
                    method = 'PUT';
                    uri += encodeURIComponent(doc._id);
                }
                opts.evalJSON = true;
                this.server.request(method, uri, dojo.toJson(doc), opts);
            },

            removeDoc: function(doc, opts) {
                opts = opts || {};
                opts.evalJSON = true;
                var uri = this.uri + encodeURIComponent(doc._id) + "?rev=" + doc._rev;
                this.server.request('DELETE', uri, null, opts);
            },

            openAttachment: function(docId, attachmentKey, opts) {
                opts = opts || {};
                var uri = this.uri + encodeURIComponent(docId) + "/" + attachmentKey;
                this.server.request('GET', uri, null, opts);
            },

            saveAttachment: function(docId, revision, attachmentKey, attachment, opts) {
                opts = opts || {};
                var uri = this.uri + encodeURIComponent(docId) + "/" + attachmentKey;
                if (revision) {
                    uri += "?rev=" + revision;
                }
                this.server.request('PUT', uri, attachment, opts);
            },

            removeAttachment: function(docId, revision, attachmentKey, opts) {
                opts = opts || {};
                opts.evalJSON = true;
                var uri = this.uri + encodeURIComponent(docId) + "/" + attachmentKey +
                    "?rev=" + revision;
                this.server.request('DELETE', uri, null, opts);
            }
        };
    }

});