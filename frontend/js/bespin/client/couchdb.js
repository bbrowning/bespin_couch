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

    // ** {{{ currentuser(onSuccess, notloggedin) }}}
    //
    // Return info on the current logged in user
    //
    // * {{{onSuccess}}} fires after the user attempt
    // * {{{notloggedin}}} fires if the user isn't logged in
    currentuser: function(whenLoggedIn, whenNotloggedin) {
        // TODO: Temporary hack until I figure out how to actually authenticate someone
        whenLoggedIn({
            username: "couchapp_user"
        });
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
        this.couchdb().loadFile(project, path, onSuccess, onFailure);
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
    }

});

// = CouchDB =
//

dojo.declare("bespin.client.CouchDB", null, {
    // ** {{{ initialize() }}}
    //
    // Object creation initialization
    //
    constructor: function() {
        this.server = new bespin.client.Server('../../..');
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

    loadFile: function(project, path, onSuccess, onFailure) {
        var url = "/" + project + "/" + path;
        this.server.request('GET', url, null, {
            onSuccess: onSuccess,
            onFailure: onFailure
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
                    bespin.publish("editor:openfile:opensuccess", { file: {
                        name: path,
                        content: content,
                        timestamp: new Date().getTime()
                    }});
                });
            },
            onFailure: function(request) {
                // TODO: Do something better than just logging here
                console.log(request.responseText);
            }
        });
    }

});