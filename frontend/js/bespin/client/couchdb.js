/* ***** BEGIN LICENSE BLOCK *****
 *
 * TODO: What do I need to put here?
 *
 * ***** END LICENSE BLOCK ***** */

dojo.provide("bespin.client.couchdb");

dojo.extend(bespin.client.Server, {

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
        var project = project || '';

        // TODO: temporary hack until I pull this data via a view
        if (project == '') {
            onSuccess([
                {'name': 'project one '},
                {'name': 'project two '}
            ]);
        } else if (project == 'project one') {
            onSuccess([
                {'name': 'test.html'}
            ]);
        } else if (project == 'project two') {
            onSuccess([
                {'name': 'index.php'}
            ]);
        }
    }
});

