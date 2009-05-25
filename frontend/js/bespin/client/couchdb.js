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
        return this.couchdb().db('user_' + user);
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
        this.appdb().openDoc('user_' + user, {}, {
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
        this.appdb().saveDoc({
            _id: 'user_' + user,
            username: user,
            password: this.encodePassword(pass),
            email: email
        }, {
            onSuccess: function() {
                server.setLoginCookie(user);
                server.userdb().create();
                server.installTemplate(server.userdb(), 'SampleProject', 'template');
                onSuccess();
            },
            on409: userconflict,
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
            this.appdb().openDoc('user_' + user, {}, {
                onSuccess: whenLoggedIn,
                onFailure: whenNotloggedin
            });
        }
        this.installTemplate(this.userdb(), 'SampleProject', 'template');
    },

    // ** {{{ list(project, path, onSuccess, onFailure) }}}
    //
    // List the path in the given project
    //
    // * {{{project}}} is the project to list
    // * {{{path}}} is the path to list out
    // * {{{onSuccess}}} fires if the list returns something
    // * {{{onFailure}}} fires if there is an error getting a list from the server
    list: function(project, path, onSuccess, onFailure) {
        result = [];
        if (!project) {
            this.couchdb().getAllProjects(function(projects) {
                onSuccess(projects);
            }, onFailure);
        } else {
            this.couchdb().getProjectFiles(project, function(files) {
                onSuccess(files);
            }, onFailure);
        }
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
        this.couchdb().saveFile(project, path, contents);
    },

    // ** {{{ processMessages() }}}
    // Starts up message retrieve for this user. Call this only once.
    processMessages: function() {
        // TODO: implement this!
    },

    installTemplate: function(db, project, template) {
        var file = 'readme.txt';
        var attachmentKey = 'templates/' + template + '/' + file;
        var saveOpts = {
            headers: { 'Content-Type': 'text/plain' }
        };
        this.appdb().openAttachment(this.appDesignDoc(), attachmentKey, {
            onSuccess: function(attachment) {
                db.openDoc(project, {}, {
                    onSuccess: function(doc) {
                        db.saveAttachment(project, doc._rev, file, attachment, saveOpts);
                    },
                    on404: function() {
                        db.saveAttachment(project, null, file, attachment, saveOpts);
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
            }
        };
    },

    getAllProjects: function(onSuccess, onFailure) {
        var url = "/_all_dbs";
        this.server.request('GET', url, null, {
            onSuccess: function(projects) {
                onSuccess(projects.map(function(project) {
                    return {'name': project + '/'};
                }));
            },
            onFailure: onFailure,
            evalJSON: true
        });
    },

    getProjectFiles: function(project, onSuccess, onFailure) {
        var url = "/" + project + "/_all_docs";
        this.server.request('GET', url, null, {
            onSuccess: function(result) {
                onSuccess(result.rows.map(function(file) {
                    return {'name': file.id};
                }));
            },
            onFailure: onFailure,
            evalJSON: true
        });
    },

    saveFile: function(project, path, contents) {
        var verb = 'PUT';
        var url = "/" + project + "/" + path;
        var couch = this;
        this.server.request(verb, url, contents, {
            onSuccess: function() {
                // After saving the file reload its contents in
                // the editor so we have the new _rev value
                couch.loadFile(project, path, function(content) {
                    var editor = bespin.get('editor');
                    editor.model.insertDocument(content);
                    //editor.cursorManager.moveCursor({ row: 0, col: 0 });
                });
            },
            onFailure: function(request) {
                // TODO: Do something better than just logging here
                console.log(request.responseText);
            }
        });
    }

});