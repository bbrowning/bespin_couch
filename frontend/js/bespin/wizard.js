/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * See the License for the specific language governing rights and
 * limitations under the License.
 *
 * The Original Code is Bespin.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
 *
 * ***** END LICENSE BLOCK ***** */

dojo.provide("bespin.wizard");

// This list of wizards that we can run. Each must have a url, which is a
// pointer to the server side resource to display, and a set of functions that
// are run by parts of the resource
bespin.wizard._wizards = {
    newuser:{
        url: "/overlays/newuser.html",
        onClose: function() {
            bespin.util.webpieces.hideCenterPopup(bespin.wizard.el);
        },
        onDie: function() {
            bespin.get("settings").set("shownewuseronload", "true");
            bespin.util.webpieces.hideCenterPopup(bespin.wizard.el);
        }
    }
};

//** {{{ Command: wizard }}} **
bespin.cmd.commands.add({
    name: 'wizard',
    takes: ['type'],
    preview: 'display a named wizard to step through some process',
    completeText: 'The name of the wizard to run. Leave blank to list known wizards',
    usage: "[type] ...<br><br><em>[type] The name of the user to run (or blank to list wizards)</em>",
    // ** {{{execute}}}
    execute: function(self, type) {
        if (!type) {
            var list = "";
            for (name in bespin.wizard._wizards) {
                list += ", " + name;
            }
            bespin.publish("message", { msg: "Known wizards: " + list.substring(2) });
            return;
        }

        bespin.publish("wizard:show", { type:type, warnOnFail:true });
    }
});

// When the HTML fetch succeeds, display it in the centerpopup div
bespin.wizard._onSuccess = function(data) {
    bespin.wizard.el = dojo.byId('centerpopup');
    bespin.wizard.el.innerHTML = data;
    dojo.query("#centerpopup script").forEach(function(node) {
        console.log("found script" + node.innerHTML);
        eval(node.innerHTML);
    });
    bespin.util.webpieces.showCenterPopup(bespin.wizard.el, true);
};

// Warn when the HTML fetch fails
bespin.wizard._onFailure = function(xhr) {
    bespin.publish("message", { msg: "Failed to display wizard: " + xhr.responseText });
};

// ** {{{ Event: wizard:show }}} **
//
// Change the session settings when a new file is opened
bespin.subscribe("wizard:show", function(event) {
    if (!event.type) {
        throw new Error("wizard:show event must have a type member");
    }

    var wizard = bespin.wizard._wizards[event.type];
    if (!wizard) {
        bespin.publish("message", { msg: "Unknown wizard: " + event.type });
        return;
    }

    var localOnFailure = event.warnOnFail ? bespin.wizard._onFailure : null;
    bespin.get('server').fetchResource(wizard.url, bespin.wizard._onSuccess, localOnFailure);
});
