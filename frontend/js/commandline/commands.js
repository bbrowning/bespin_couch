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

if (typeof Bespin == "undefined") Bespin = {};
if (!Bespin.Commands) Bespin.Commands = {};

// = Bespin.Commands =
//
// This array stores all of the default commands.

// ** {{{Bespin.Commands.Store}}} **
//
// The core store to hold commands that others share.
Bespin.Commands.Store = {};

// ** {{{Bespin.Commands.add}}} **
//
// Add the command to the store which has a name -> command hash
Bespin.Commands.add = function(command) {
    Bespin.Commands.Store[command.name] = command;
}

// ** {{{Bespin.Commands.get}}} **
//
// Return a command from the store
Bespin.Commands.get = function(commandname) {
    return Bespin.Commands.Store[commandname];
}

// == Start adding commands to the store ==
//

// ** {{{Command: help}}} **
Bespin.Commands.add({
    name: 'help',
    takes: ['search'],
    preview: 'show commands',
    description: 'The <u>help</u> gives you access to the various commands in the Bespin system.<br/><br/>You can narrow the search of a command by adding an optional search params.<br/><br/>If you pass in the magic <em>hidden</em> parameter, you will find subtle hidden commands.<br/><br/>Finally, pass in the full name of a command and you can get the full description, which you just did to see this!',
    completeText: 'optionally, narrow down the search',
    execute: function(self, extra) {
        var commands = [];
        if (self.commands[extra]) { // caught a real command
            commands.push("<u>Help for the command: <em>" + extra + "</em></u><br/>");
            var command = self.commands[extra];
            commands.push(command['description'] ? command.description : command.preview);
        } else {
            var showHidden = false;
            commands.push("<u>Commands Available</u><br/>");

            if (extra) {
                if (extra == "hidden") { // sneaky, sneaky.
                    extra = "";
                    showHidden = true;
                }
                commands.push("<em>(starting with</em> " + extra + " <em>)</em><br/>");
            }

            var tobesorted = [];
            for (name in self.commands) {
                tobesorted.push(name);
            }

            var sorted = tobesorted.sort();
            
            for (var i = 0; i < sorted.length; i++) {
                var name = sorted[i];
                var command = self.commands[name];

                if (!showHidden && command.hidden) continue;
                if (extra && name.indexOf(extra) != 0) continue;

                var arguments = (command.takes) ? ' [' + command.takes.order.join('] [') + ']' : '';
                commands.push('<b>' + name + arguments + '</b>: ' + command.preview);
            }
        }
        self.showInfo("<div style='font-size: 0.80em'>" + commands.join("<br/>") + "</div>");
    }
}); 

// ** {{{Command: set}}} **
Bespin.Commands.add({
        name: 'set',
        takes: ['key', 'value'],
        preview: 'define and show settings',
        completeText: 'optionally, add a key and/or a value, else you will see all settings',
        // complete: function(self, value) {
        //     console.log(self);
        //     console.log(value);
        //     return value;
        // },
        execute: function(self, setting) {
            var output;

            if (!setting.key) { // -- show all
                var settings = self.settings.list();

                output = "<u>Your Settings</u><br/><br/>";
                for (var x = 0; x < settings.length; x++) {
                    if (settings[x].key[0] != '_') {
                        output += settings[x].key + ": " + settings[x].value + "<br/>";
                    }
                }
            } else {
                var key = setting.key;
                if (setting.value == undefined) { // show it
                    var value = self.settings.get(key);
                    if (value) {
                        output = "<u>Your setting</u><br/><br/>";
                        output += key + ": " + value;                        
                    } else {
                        output = "You do not have a setting for <em>" + key + "</em>";
                    }
                } else {
                    output = "<u>Saving setting</u><br/><br/>";
                    output += key + ": " + setting.value;
                    self.settings.set(key, setting.value);
                }
            }
            self.showInfo(output);
        }
});

// ** {{{Command: files (ls, list)}}} **
Bespin.Commands.add({
    name: 'files',
    aliases: ['ls', 'list'],
    takes: ['project'],
    preview: 'show files',
    completeText: 'optionally, add the project name of your choice',
    execute: function(self, project) {
        if (!project && (typeof _editSession != "undefined") ) {
            project = _editSession.projectForDisplay();
        }

        if (!project) {
            self.showInfo("You need to pass in a project");
            return;
        }

        self.files.fileNames(project, function(fileNames) {
            var files = "<u>Files in project: " + project + "</u><br/><br/>";
            for (var x = 0; x < fileNames.length; x++) {
                files += fileNames[x].name + "<br/>";
            }
            self.showInfo(files);
        });
    }
});

// ** {{{Command: status}}} **
Bespin.Commands.add({
    name: 'status',
    preview: 'get info on the current project and file',
    execute: function(self) {
      var file = _editSession.path || 'a new scratch file';
      self.showInfo('Hey ' + _editSession.username + ', you are editing ' + file + ' in project ' + _editSession.projectForDisplay());
    }
});

// ** {{{Command: project}}} **
Bespin.Commands.add({
    name: 'project',
    takes: ['projectname'],
    preview: 'show the current project, or set to a new one',
    completeText: 'optionally, add the project name to change to that project',
    execute: function(self, projectname) {
        if (projectname) {
            document.fire("bespin:editor:project:set", { project: projectname });
        } else {
            self.executeCommand('status');
        }
    }
});

// ** {{{Command: projects}}} **
Bespin.Commands.add({
    name: 'projects',
    preview: 'show projects',
    execute: function(self, extra) {
      self.files.projects(function(projectNames) {
          var projects = "<u>Your projects</u><br/><br/>";
          for (var x = 0; x < projectNames.length; x++) {
            projects += projectNames[x].name + "<br/>";
          }
          self.showInfo(projects);
      });
    }
});

// ** {{{Command: clipboard}}} **
Bespin.Commands.add({
    name: 'clipboard',
    version: 0.1,
    preview: 'export the contents to the clipboard',
    execute: function(self) {
        Bespin.Clipboard.copy(self.editor.model.getDocument());

        self.showInfo('Saved file contents to clipboard');
    }
});

// ** {{{Command: save}}} **
Bespin.Commands.add({
    name: 'save',
    takes: ['filename'],
    preview: 'save the current contents',
    completeText: 'add the filename to save as, or use the current file',
    execute: function(self, filename) {
        document.fire("bespin:editor:savefile", {
            filename: filename
        });
    }
});

// ** {{{Command: load (open)}}} **
Bespin.Commands.add({
    name: 'load',
    aliases: ['open'],
    takes: ['filename'],
    preview: 'load up the contents of the file',
    completeText: 'add the filename to open',
    execute: function(self, filename) {
        document.fire("bespin:editor:openfile", {
            filename: filename
        });
    }
});

// ** {{{Command: preview}}} **
Bespin.Commands.add({
    name: 'preview',
    takes: ['filename'],
    preview: 'view the file in a new browser window',
    completeText: 'add the filename to view or use the current file',
    execute: function(self, filename) {
        document.fire("bespin:editor:preview", {
            filename: filename 
        });
    }
});

// ** {{{Command: editconfig}}} **
Bespin.Commands.add({
    name: 'editconfig',
    aliases: ['config'],
    preview: 'load up the config file',
    execute: function(self) {
        document.fire("bespin:editor:config:edit");
    }
});

// ** {{{Command: runconfig}}} **
Bespin.Commands.add({
    name: 'runconfig',
    preview: 'run your config file',
    execute: function(self) {
        document.fire("bespin:editor:config:run");
    }
});

// ** {{{Command: cmdadd}}} **
Bespin.Commands.add({
    name: 'cmdadd',
    takes: ['commandname'],
    preview: 'load up a new command',
    completeText: 'required, command name to add',
    usage: 'cmdadd commandname: Command name required.',
    execute: function(self, commandname) {
        if (!commandname) {
            self.showUsage(this);
            return;
        }
        document.fire("bespin:editor:commands:add", { commandname: commandname });
    }
});

// ** {{{Command: newfile}}} **
Bespin.Commands.add({
    name: 'newfile',
    //aliases: ['new'],
    takes: ['filename', 'project'],
    preview: 'create a new buffer for file',
    completeText: 'optionally, name the new filename',
    withKey: "CTRL SHIFT N",            
    execute: function(self, args) {
        if (args.filename) {
            args.newfilename = args.filename;
            delete args.filename;
        }
        document.fire("bespin:editor:newfile", args || {});
    }
});

// ** {{{Command: rm (remove, del)}}} **
Bespin.Commands.add({
    name: 'rm',
    aliases: ['remove', 'del'],
    takes: ['filename'],
    preview: 'remove the file',
    completeText: 'add the filename to remove',
    execute: function(self, filename) {
        if (!filename) {
            self.showInfo("give me a filename or directory to delete");
            return;
        }
        
        self.files.removeFile(_editSession.project, filename, function() {
            if (_editSession.path == filename) self.editor.model.clear(); // only clear if deleting the same file
            self.showInfo('Removed file: ' + filename, true);
        }, function(xhr) {
            self.showInfo("Wasn't able to remove the file <b>" + filename + "</b><br/><em>Error</em> (probably doesn't exist): " + xhr.responseText);
        });
    }
});

// ** {{{Command: closefile}}} **
Bespin.Commands.add({
    name: 'closefile',
    takes: ['filename', 'project'],
    preview: 'close the file (may lose edits)',
    completeText: 'add the filename to close (defaults to this file).<br>also, optional project name.',
    execute: function(self, args) {
        document.fire("bespin:editor:closefile", args);
    }
});

// ** {{{Command: dashboard}}} **
Bespin.Commands.add({
    name: 'dashboard',
    preview: 'navigate to the file',
    execute: function(self) {
        Bespin.Navigate.dashboard();
    }
});

// ** {{{Command: version}}} **
Bespin.Commands.add({
    name: 'version',
    takes: ['command'],
    preview: 'show the version for Bespin or a command',
    completeText: 'optionally, a command name',
    execute: function(self, command) {
        var bespinVersion = 'Your Bespin is at version ' + Bespin.versionNumber + ', Code name: "' + Bespin.versionCodename + '"';
        var version;
        if (command) {
            var theCommand = self.commands[command];
            if (!theCommand) {
                version = "It appears that there is no command named '" + command + "', but " + bespinVersion;
            } else {
                version = (theCommand.version)
                    ? "The command named '" + command + "' is at version " + theCommand.version 
                    : "The command named '" + command + "' is a core command in Bespin version " + Bespin.versionNumber;
            }
        } else {
            version = bespinVersion;
        }
        self.showInfo(version);
    }
});

// ** {{{Command: clear}}} **
Bespin.Commands.add({
    name: 'clear',
    aliases: ['cls'],
    preview: 'clear the file',
    execute: function(self) {
        self.editor.model.clear();
    }
});

// ** {{{Command: goto}}} **
Bespin.Commands.add({
    name: 'goto',
    takes: ['linenumber'],
    preview: 'move it! make the editor head to your line number.',
    completeText: 'add the line number to move to',
    execute: function(self, linenumber) {
        if (linenumber) {
            var linenumAsInt = parseInt(linenumber) - 1;
            
            self.editor.moveCursor({ row: linenumAsInt, col: 0 });
            
            // If the line that we are moving to is off screen, center it, else just move in place
            if ( (linenumAsInt < self.editor.ui.firstVisibleRow) || (linenumAsInt >= self.editor.ui.firstVisibleRow+self.editor.ui.visibleRows) ) {
                document.fire("bespin:editor:doaction", {
                    action: 'moveCursorRowToCenter'
                });
            }
        }
    }
});

// ** {{{Command: replace}}} **
Bespin.Commands.add({
    name: 'replace',
    takes: ['search', 'replace'],
    preview: 's/foo/bar/g',
    completeText: 'add the search regex, and then the replacement text',
    execute: function(self, args) {
        self.editor.model.replace(args.search, args.replace);
    }
});

// ** {{{Command: login}}} **
Bespin.Commands.add({
    name: 'login',
    // aliases: ['user'],
    //            takes: ['username', 'password'],
    hidden: true,
    takes: {
        order: ['username', 'password'],
        username: {
            "short": 'u',
        },
        password: {
            "short": 'p',
            optional: true
        }
    },
    preview: 'login to the service',
    completeText: 'pass in your username and password',
    execute: function(self, args) {
        if (!args) { // short circuit if no username
            self.executeCommand("status");
            return;
        }
        _editSession.username = args.user; // TODO: normalize syncing
        _server.login(args.user, args.pass);
    }
});

// ** {{{Command: logout}}} **
Bespin.Commands.add({
    name: 'logout',
    preview: 'log out',
    execute: function(self) {
        delete _editSession.username;
        _server.logout(function() {
			window.location.href="/";
		});
    }
});

// ** {{{Command: bespin}}} **
Bespin.Commands.add({
    name: 'bespin',
    preview: 'has',
    hidden: true,
    messages: [
        "really wants you to trick it out in some way.",
        "is your Web editor.",
        "would love to be like Emacs on the Web.",
        "is written on the Web platform, so you can tweak it."
    ],
    execute: function(self) {
        self.showInfo("Bespin " + this.messages[Math.floor(Math.random() * this.messages.length)]);
    }
});

// ** {{{Command: action}}} **
Bespin.Commands.add({
    name: 'action',
    takes: ['actionname'],
    preview: 'execute any editor action',
    hidden: true,
    execute: function(self, actionname) {
        document.fire("bespin:editor:doaction", {
            action: actionname
        });
    }
});

// ** {{{Command: sort}}} **
Bespin.Commands.add({
    name: 'sort',
    takes: ['direction'],
    preview: 'sort the current buffer',
    completeText: 'optionally, sort descending',
    execute: function(self, direction) {
        var buffer = self.editor.model.getDocument().split(/\n/);
        buffer.sort();
        if (direction && direction.toLowerCase().startsWith("desc")) buffer.reverse();
        self.editor.model.insertDocument(buffer.join("\n"));
    }
});

// ** {{{Command: export}}} **
Bespin.Commands.add({
    name: 'export',
    takes: ['project', 'archivetype'],
    preview: 'export the given project with an archivetype of zip or tgz',
    completeText: 'project name, archivetype (zip | tgz, defaults to zip)',
    execute: function(self, args) {
        var project = args.project || _editSession.project;
        
        var type = args.archivetype;
        if (!['zip','tgz','tar.gz'].include(type)) {
            type = 'zip';
        }

        _server.exportProject(project, type); // try to do it via the iframe
    }
});

// ** {{{Command: import}}} **
Bespin.Commands.add({
    name: 'import',
    takes: ['url', 'project'],
    preview: 'import the given url as a project.<br>If a project name isn\'t given it will use the filename',
    completeText: 'url (to an archive zip | tgz), optional project name',
    usage: "Please run: import [url of archive] [projectname]<br><br><em>(projectname optional. Will be taken from the URL if not provided)</em>",
    // ** {{{calculateProjectName}}}
    //
    // Given a URL, work out the project name as a default
    // For example, given http://foo.com/path/to/myproject.zip
    // return "myproject"
    calculateProjectName: function(url) {
        var projectMaker = url.split('/').last().split(".");
        projectMaker.pop();
        return projectMaker.join("_");
    },
    // ** {{{isURL}}}
    //
    // Test the given string to return if it is a URL.
    // In this context it has to be http(s) only
    isURL: function(url) {
        return (url && (url.startsWith("http:") || url.startsWith("https:")));
    },
    // ** {{{execute}}}
    //
    // Can be called in three ways:
    //
    // * import http://foo.com/path/to/archive.zip
    // * import http://foo.com/path/to/archive.zip projectName
    // * import projectName http://foo.com/path/to/archive.zip
    execute: function(self, args) {
        // Fail fast. Nothing given?
        if (!args.url) {
            self.showUsage(this);
            return;
        // * checking - import http://foo.com/path/to/archive.zip
        } else if (!args.project && this.isURL(args.url)) {
            args.project = this.calculateProjectName(args.url);
        // * Oops, project and url are the wrong way around. That's fine
        } else if (this.isURL(args.project)) {
            var project = args.project;
            var url = args.url;
            args.project = url;
            args.url = project;
        // * Make sure that a URL came along at some point
        } else if (!this.isURL(args.url)) {
            this.usage(self);
            return;            
        }
        
        var project = args.project;
        var url = args.url;

        self.showInfo("About to import " + project + " from:<br><br>" + url + "<br><br><em>It can take awhile to download the project, so be patient!</em>");

        _server.importProject(project, url, { call: function(xhr) {
            self.showInfo("Project " + project + " imported from:<br><br>" + url);
        }, onFailure: function(xhr) {
            self.showInfo("Unable to import " + project + " from:<br><br>" + url + ".<br><br>Maybe due to: " + xhr.responseText);
        }});
    }
});

// ** {{{Command: doctype}}} **
Bespin.Commands.add({
    name: 'doctype',
    takes: ['section'], // part on the Wiki
    preview: 'grab the doctype info for a section',
    completeText: 'can you give me the Doctype wiki section?',
    hidden: true,
    execute: function(self, section) {
        //TODO grab the HTML: http://code.google.com/p/doctype/wiki/SectionElement?show=content
    }
});

// ** {{{Command: trim}}} **
Bespin.Commands.add({
    name: 'trim',
    takes: ['side'], // left, right, both
    preview: 'trim trailing or leading whitespace',
    completeText: 'optionally, give a side of left, right, or both (defaults to right)',
    execute: function(self, side) {
        self.editor.model.changeEachRow(function(row) {
            if (!side) side = "right";
            if (["left", "both"].include(side)) {
                while (row.first() == ' ') {
                    row.shift();
                }
            }
            if (["right", "both"].include(side)) {
                var i = row.length - 1;

                while (row[i] == ' ') {
                    delete row[i];
                    i--;
                }
            }
            return row;
        });
    }
});

// ** {{{Command: bindkey}}} **
Bespin.Commands.add({
    name: 'bindkey',
    takes: ['modifier', 'key', 'action'],
    preview: 'Bind a key to an action',
    completeText: 'give a modifier, key, and action name',
    hidden: true,
    execute: function(self, args) {
        if (args.modifiers == "none") args.modifiers = '';

        document.fire("bespin:editor:bindkey", args);
    }
});

// ** {{{Command: insert}}} **
Bespin.Commands.add({
    name: 'insert',
    takes: ['text'],
    preview: 'insert the given text at this point.',
    hidden: true,
    execute: function(self, text) {
        self.editor.model.insertChunk(self.editor.cursorPosition, text);
    }
});

// ** {{{Command: typingtest}}} **
Bespin.Commands.add({
    name: 'typingtest',
    preview: 'type in the alphabet a few times',
    hidden: true,
    execute: function(self) {
        var start = Date.now();

        for (var i = 0; i < 3; i++) {
            $R('a', 'z').each(function(c) {
                var args = { pos: Bespin.Editor.Utils.copyPos(self.editor.cursorPosition) };
                args.newchar = c;
                self.editor.ui.actions.insertCharacter(args);            
            });
        }
        
        var stop = Date.now();
        
        self.showInfo("It took " + (stop - start) + " milliseconds to do this");        
    }
});

// ** {{{Command: template}}} **
Bespin.Commands.add({
    name: 'template',
    takes: ['type'],
    preview: 'insert templates',
    completeText: 'pass in the template name',
    templates: { 'in': "for (var key in object) {\n\n}"},
    execute: function(cmdline, type) {
        cmdline.editor.model.insertChunk(cmdline.editor.cursorPosition, this.templates[type]);
    }
});

// ** {{{Command: alias}}} **
Bespin.Commands.add({
    name: 'alias',
    takes: ['alias', 'command'],
    preview: 'define and show aliases for commands',
    completeText: 'optionally, add your alias name, and then the command name',
    execute: function(self, args) {
      var output;
      if (!args.alias) { // -- show all
        output = "<u>Your Aliases</u><br/><br/>";
        for (var x in self.aliases) {
          output += x + ": " + self.aliases[x] + "<br/>";
        }
      } else {
        if (args.command == undefined) { // show it
          output = "<u>Your alias</u><br/><br/>";
          output += args.alias + ": " + self.aliases[args.alias];
        } else {
          var key = args.alias;
          var value = args.command;
          output = "<u>Saving setting</u><br/><br/>";
          if (self.commands[value]) {
              output += key + ": " + value;
            self.aliases[key] = value;
          } else if (self.aliases[value]) { // TODO: have the symlink to the alias not the end point
              output += key + ": " + self.aliases[value] + " (" + value + " was an alias itself)";
            self.aliases[key] = value;
          } else {
            output += "Sorry, no command or alias with that name."
          }
        }
      }
      self.showInfo(output);
    },
});

// ** {{{Command: history}}} **
Bespin.Commands.add({
    name: 'history',
    preview: 'show history of the commands',
    execute: function(self) {
        self.showInfo('<u>Command History</u><br/><br/>' + self.commandLineHistory.history.join('<br/>'));
    }
});

// ** {{{Command: use}}} **
Bespin.Commands.add({
    name: 'use',
    preview: 'use patterns to bring in code',
    completeText: '"sound" will add sound support',
    libnames: {
        'jquery': 'jquery.min.js'
    },
    execute: function(self, type) {
        if (type == 'sound') {
            self.editor.model.insertChunk({ row: 3, col: 0 },
                '  <script type="text/javascript" src="soundmanager2.js"></script>\n');
            self.editor.model.insertChunk({ row: 4, col: 0 },
                "  <script>\n  var sound; \n  soundManager.onload = function() {\n    sound =  soundManager.createSound('mySound','/path/to/mysoundfile.mp3');\n  }\n  </script>\n");
        } else if (type == 'js') {
            var jslib = 'http://ajax.googleapis.com/ajax/libs/jquery/1.2.6/jquery.min.js';
            var script = '<script type="text/javascript" src="' + jslib + '"></script>\n';
            self.editor.model.insertChunk({ row: 3, col: 0 }, script);
        }
    }
});
