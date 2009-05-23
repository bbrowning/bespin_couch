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
        return this.server.request('GET', url, null, {
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
        return this.server.request('GET', url, null, {
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
        return this.server.request('GET', url, null, {
            onSuccess: onSuccess,
            onFailure: onFailure
        });
    }

});