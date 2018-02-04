/** 
 * Test Abvos SPA server
 */
"use strict";

// node --inspect server.js | Open 'about:inspect' in Chrome
// export DEBUG=abv:*,info / unset DEBUG
const ts = require('abv-ts')('abv:spa.test');

const Aspa = require('../index.js');

const $port = 8080;
const $host = '0.0.0.0';
const $root = __dirname + '/public';
const $start = Date.now();
const $logs = [];

const aspa = new Aspa({root: $root, cache: 3});

// fallback if no index.html
aspa.on('/',(req, res) => {
		res.end('Aspa server: ' + req.url);
	});

aspa.on('/time/',(req, res) => {
		const r = aspa.res(200, req.url, Date.now() + ': ' + req.url);ts.debug(r.size);
		r.send(res);
	});

aspa.on('/stat/',(req, res) => {
		aspa.auth('aspa','pass',req,res, () => {
		let body = '<h3>' + aspa.link('/','Uptime') + ': ';
		body += ts.time(Date.now() - $start) + '</h3>';
		const f = aspa.stat(aspa.sign);
		body += '<p><b>Cache</b><br />Timeout: ' + (aspa.opt.cache/1000);
		body += ' sec<br />Files: ' + f.size + '</p>';
		for(let [k,v] of f.entries()) body += aspa.link(k) + '<br />'; 
// logs		
		body += '<br><h3>Logs: ' + $logs.length + ' lines</h3>';
		const clr = ['','','gray','green','red','blue'];
		let c, s;
		for (let l of $logs){
			c = Math.round(l.code/100);
			s = ' ' + l.host  + ' [' + (new Date(l.time).toUTCString()) + 
				'] "GET ' + l.url + '" '+ l.code +' ' + l.size;
			body += '<span style="color:'+clr[c]+'">' + s + '</span><br>';
		}
		const meta = '<meta http-equiv="refresh" content="30">';
		const r = aspa.res(200, req.url, aspa.page('Stats',body,meta));
		r.send(res);
		});
	});

aspa.on('/logs/',(req, res) => {
		let body = aspa.link('/','Home') + '<br><br>';
		body += '<h3>Logs: ' + $logs.length + ' lines</h3>';
		const clr = ['','','gray','green','red','blue'];
		let c, s;
		for (let l of $logs){
			c = Math.round(l.code/100);
			s = ' ' + l.host  + ' [' + (new Date(l.time).toUTCString()) + 
				'] "GET ' + l.url + '" '+ l.code +' ' + l.size;
			body += '<span style="color:'+clr[c]+'">' + s + '</span><br>';
		}
		const r = aspa.res(200, req.url, aspa.page('Logs',body));
		r.send(res);
	});

aspa.tpl('/index.html',{ttl: () => {return Date.now();}});

aspa.log = (l) => {
		$logs.push(l);
		const s = ' ' + l.host  + ' [' + (new Date(l.time).toUTCString()) + 
			'] "GET ' + l.url + '" '+ l.code +' ' + l.size;
		const c = Math.round(l.code/100);
		if (c === 2)ts.println(s,ts.GRAY); 
		else if (c === 4)ts.println(s,ts.RED); 
		else if (c === 3)ts.println(s,ts.GREEN); 
		else ts.println(s,ts.ORANGE);
	
};

const $ip = aspa.ips()[0];

aspa.listen($port, $host, (err) => {  
	if (err) return ts.error(58,err);
	ts.println(`Aspa server is running on http://${$ip}:${$port}`,ts.BLUE);
});
