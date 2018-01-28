/** 
 * Test Abvos SPA server
 */
"use strict";

// node --inspect server.js | Open 'about:inspect' in Chrome
// export DEBUG=abv:*,info / unset DEBUG
const ts = require('abv-ts')('abv:spa.test');

const Aspa = require('../index.js');
const Response = require('../lib/Response.js');
const aspa = new Aspa();

const $port = 8080;
const $host = '0.0.0.0';
const $root = __dirname + '/public';
const $start = Date.now();

aspa.set('root',$root);
aspa.set('cache',3);

// fallback if no index.html
aspa.on('/',(req, res) => {
		res.end('Aspa server: ' + req.url);
	});
	
aspa.on('/time/',(req, res) => {
		const r = aspa.res(200, req.url, Date.now() + ': ' + req.url);
		r.send(res);
	});

aspa.on('/stat/',(req, res) => {
		let body = '<h3>Uptime: ' + ts.time(Date.now() - $start) + '</h3>';
		const f = aspa.stat(aspa.name);
		body += '<p><b>Cache</b><br />Timeout: ' + (aspa.get('cache')/1000);
		body += '<br />Files: ' + f.size + '</p>';
		for(let [k,v] of f.entries()) body += aspa.link(k) + '<br />'; 
		const r = aspa.res(200, req.url, aspa.page('Stats',body));
		r.send(res);
	});

aspa.tpl('/index.html',{ttl: () => {return Date.now();}});

aspa.log = (l) => {
		const s = ' ' + l.host  + ' [' + (new Date(l.time).toUTCString()) + 
			'] "GET ' + l.url + '" '+ l.code +' ' + l.size;
		const c = Math.round(l.code/100);
		if (c === 2)ts.println(s,ts.GRAY); 
		else if (c === 4)ts.println(s,ts.RED); 
		else if (c === 3)ts.println(s,ts.GREEN); 
		else ts.println(s,ts.ORANGE);
	
};

const $ip = aspa.ips()[0];

aspa.listen($port, $host, function(err) {  
	if (err) return ts.error(58,err.stack);
	ts.println(`Aspa server is running on http://${$ip}:${$port}`,'blue');
});
