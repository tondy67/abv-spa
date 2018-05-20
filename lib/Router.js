/** 
 * Router
 */
"use strict";

const ts = require('abv-ts')('abv:spa.Router');

const GET = 'get';
const POST = 'post';
const MATCH = 'match';

class Router
{
	constructor()
	{
		this.routes = new Map();
	}
	
	add(method, url, cb)
	{
		this.routes.set(url, {method: method, cb: cb});
	}
	
	get(url, cb)
	{
		if (url === '/') url = '';
		this.add(GET, url, cb);
	}

	post(url, cb)
	{
		this.add(POST, url, cb);
	}

	match(url, cb)
	{
		this.add(MATCH, url, cb);
	}

	enable(srv, url)
	{
		if (!srv) return;
		
	//	url = ts.add(url, '/', '/');
	
		for(let [k,v] of this.routes.entries())	{
			if (!v) continue;
			k = ts.rs(url + k);
			if (v.method === GET) srv.get(k, v.cb);
			else if (v.method === POST) srv.post(k, v.cb);
			else if (v.method === MATCH) srv.match(k, v.cb);
		} 
	}
}

module.exports = Router;
