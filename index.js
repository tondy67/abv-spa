/**
 * Abvos SPA web server
 * https://github.com/tondy67/abv-spa
 */
"use strict";

const Aspa = require('./lib/Aspa.js');

const aspa = new Aspa();

module.exports = () => { return aspa; };
