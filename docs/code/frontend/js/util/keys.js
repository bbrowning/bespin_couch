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

// = Key Helpers =
//
// Helpful code to deal with key handling and processing
// Consists of two core pieces:
//
// * {{{Bespin.Key}}} is a map of keys to key codes
// * {{{Bespin.Key.fillArguments}}} converts a string "CTRL A" to its key and modifier
//
// TODO: Having the keys in the same scope as the method is really bad :)

// ** {{{ Bespin.Key }}} **
//
// Alpha keys, and special keys (ENTER, BACKSPACE) have key codes that our code needs to check.
// This gives you a way to say Key.ENTER when matching a key code instead of "13"

Bespin.Key = {

// -- Alphabet
  A: 65,
  B: 66,
  C: 67,
  D: 68,
  E: 69,
  F: 70,
  G: 71,
  H: 72,
  I: 73,
  J: 74,
  K: 75,
  L: 76,
  M: 77,
  N: 78,
  O: 79,
  P: 80,
  Q: 81,
  R: 82,
  S: 83,
  T: 84,
  U: 85,
  V: 86,
  W: 87,
  X: 88,
  Y: 89,
  Z: 90,

// -- Special Keys
  BACKSPACE: 8,
  TAB: 9,
  ENTER: 13,
  ESCAPE: 27,
  END: 35,
  HOME: 36,
  ARROW_LEFT: 37,
  ARROW_UP: 38,
  ARROW_RIGHT: 39,
  ARROW_DOWN: 40,
  DELETE: 46,
  PAGE_UP: 33,
  PAGE_DOWN: 34
};

// ** {{{ Bespin.Key.fillArguments }}} **
//
// Fill out the arguments for action, key, modifiers
//
// {{{string}}} can be something like "CTRL S"
// {{{args}}} is the args that you want to modify. This is common as you may already have args.action.

Bespin.Key.fillArguments = function(string, args) {
    var keys = string.split(' ');
    args = args || {};
    
    var modifiers = [];
    keys.each(function(key) {
       if (key.length > 1) { // more than just an alpha/numeric
           modifiers.push(key);
       } else {
           args.key = key;
       }
    });

    if (modifiers.length == 0) { // none if that is true
        args.modifiers = "none";
    } else {
        args.modifiers = modifiers.join(',');
    }
    
    return args;
}