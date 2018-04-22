/**
 * Test routes
 */
"use strict";

const ts = require('abv-ts')('abv:spa.routes');
const aspa = require('../index.js')();

const route = aspa.router();

route.match('/(.*)',(match, res) => {
	aspa.open('/page.html',res);
	let name = '';
	try{ name = 'User ' + decodeURI(match[1]); }catch(e){}
	const body = aspa.link('/features.html','Back') + `<h3>${name}</h3>`;
	const tpl = {title: name, body: body};
	res.send(200, tpl);
});


module.exports = route;
