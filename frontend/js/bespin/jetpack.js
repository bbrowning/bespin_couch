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

/*
 * Jetpack Plugin
 * --------------
 *
 * The Jetpack plugin aims to make Bespin a good environment for creating and hosting Jetpack extensions.
 *
 * Read more about Jetpack at: https://wiki.mozilla.org/Labs/Jetpack/API
 */

dojo.provide("bespin.jetpack");

dojo.require("bespin.util.webpieces");
dojo.require("bespin.cmd.commands");
dojo.require("bespin.cmd.commandline");

bespin.jetpack.projectName = "jetpacks";

// Command store for the Jetpack commands
// (which are subcommands of the main 'jetpack' command)
bespin.jetpack.commands = new bespin.cmd.commandline.CommandStore({ subCommand: {
    name: 'jetpack',
    preview: 'play with jetpack features',
    completeText: 'subcommands: create [name] [type], install [name], list, edit [name]',
    subcommanddefault: 'help'
}});

// = Commands =
// Jetpack related commands

// ** {{{Command: jetpack help}}} **
bespin.jetpack.commands.addCommand({
    name: 'help',
    takes: ['search'],
    preview: 'show commands for jetpack subcommand',
    description: 'The <u>help</u> gives you access to the various commands in the Bespin system.<br/><br/>You can narrow the search of a command by adding an optional search params.<br/><br/>Finally, pass in the full name of a command and you can get the full description, which you just did to see this!',
    completeText: 'optionally, narrow down the search',
    execute: function(self, extra) {
        bespin.cmd.displayHelp(bespin.jetpack.commands, self, extra, "<br><br>For more info and help on the available API, <a href='https://wiki.mozilla.org/Labs/Jetpack/API'>check out the Reference</a>");
    }
});

// ** {{{Command: jetpack create}}} **
bespin.jetpack.commands.addCommand({
    name: 'create',
    takes: ['feature', 'type'],
    preview: 'create a new jetpack feature of the given type (defaults to sidebar)',
    description: 'Create a new jetpack feature that you can install into Firefox with the new Jetpack goodness.',
    completeText: 'name of your feature, type of JetPack template (sidebar, content, toolbar)',
    execute: function(self, opts) {
        var feature = opts.feature || 'newjetpack';
        var type = opts.type || 'sidebar';
        var project = bespin.jetpack.projectName;
        var filename = feature + ".html";
        
        var templateOptions = {
            stdtemplate: "jetpacks/" + type + ".html",
            values: {
                templateName: feature
            }
        };
        
        bespin.get("server").fileTemplate(project, 
            filename,
            templateOptions,
            {
                onSuccess: function(xhr) {
                    bespin.util.navigate.editor(project, filename, {});
                },
                onFailure: function(xhr) {
                        this.showInfo("Unable to create " 
                            + filename + ": "
                            + xhr.responseText);
                }
            }
        );

    }
});

// ** {{{Command: jetpack install}}} **
bespin.jetpack.commands.addCommand({
    name: 'install',
    takes: ['feature'],
    preview: 'install a jetpack feature',
    description: 'Install a Jetpack feature, either the current file, or the named feature',
    completeText: 'optionally, the name of the feature to install',
    execute: function(self, feature) {
        // For when Aza exposes the Jetpack object :)
        // if (!window['Jetpack']) {
        //     bespin.publish("message", { msg: "To install a Jetpack, you need to have installed the extension.<br><br>For now this lives in Firefox only, and you can <a href='https://wiki.mozilla.org/Labs/Jetpack/API'>check it out, and download the add-on here</a>." });
        //     return;
        // }

        // Use the given name, or default to the current jetpack
        feature = feature || (function() {
            var editSession = bespin.get('editSession');
            if (editSession.project != bespin.jetpack.projectName) return; // jump out if not in the jetpack project
            var bits = editSession.path.split('.');
            return bits[bits.length - 2];
        })();

        if (!feature) {
            bespin.publish("message", { msg: "Please pass in the name of the Jetpack feature you would like to install" });
        } else {
            // add the link tag to the body
            // <link rel="jetpack" href="1.0/main.html" name="testExtension">
            var link = dojo.create("link", {
                rel: 'jetpack',
                href: bespin.util.path.combine("preview/at", bespin.jetpack.projectName, feature + ".html"),
                name: feature
            }, dojo.body());
        }
    }
});

// ** {{{Command: jetpack list}}} **
bespin.jetpack.commands.addCommand({
    name: 'list',
    preview: 'list out the Jetpacks that you have written',
    description: 'Which Jetpacks have you written and have available in BespinSettings/jetpacks. NOTE: This is not the same as which Jetpacks you have installed in Firefox!',
    execute: function(self, extra) {
        bespin.get('server').list(bespin.jetpack.projectName, '', function(jetpacks) {
            var output;

            if (!jetpacks || jetpacks.length < 1) {
                output = "You haven't installed any Jetpacks. Run '> jetpack create' to get going.";
            } else {
                output = "<u>Your Jetpack Features</u><br/><br/>";

                output += dojo.map(dojo.filter(jetpacks, function(file) {
                    return bespin.util.endsWith(file.name, '\\.html');
                }), function(c) {
                    return "<a href=\"javascript:bespin.get('commandLine').executeCommand('open " + c.name + " " + bespin.jetpack.projectName + "');\">" + c.name.replace(/\.html$/, '') + "</a>";
                }).join("<br>");
            }

            bespin.publish("message", { msg: output });
        });
    }
});

// ** {{{Command: jetpack edit}}} **
bespin.jetpack.commands.addCommand({
    name: 'edit',
    takes: ['feature'],
    preview: 'edit the given Jetpack feature',
    completeText: 'feature name to edit (required)',
    usage: '[feature]: feature name required.',
    execute: function(self, feature) {
        if (!feature) {
            self.showUsage(this);
            return;
        }

        var path = feature + '.html';

        bespin.get('files').whenFileExists(bespin.jetpack.projectName, path, {
            execute: function() {
                bespin.publish("editor:openfile", {
                    project: bespin.jetpack.projectName,
                    filename: path
                });
            },
            elseFailed: function() {
                bespin.publish("message", {
                    msg: "No feature called " + feature + ".<br><br><em>Run 'jetpack list' to see what is available.</em>"
                });
            }
        });
    }
});