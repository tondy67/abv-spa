/** 
 * Test Abvos SPA server
 */
"use strict";

// node --inspect server.js | Open 'about:inspect' in Chrome
// export DEBUG=abv:*,info / unset DEBUG
const ts = require('abv-ts')('abv:spa.test');
const fs = require('abv-vfs');

const $port = 8080;
const $host = '0.0.0.0';
const $root = __dirname + '/public';// '/../../tondy67.github.io';//
const $start = Date.now();
const $logs = [];

const aspa = require('../index.js')();
aspa.set('root', $root);
aspa.set('cache',3000);

const route = require('./routes.js');

aspa.get('/time/', res => {
	res.body = Date.now() + ': ' + res.name;
	res.send();
});

aspa.post('/action', (res, post) => {
	aspa.open('/page.html',res);
	const name = ts.toJson(post.params);
	const body = aspa.link('/form.html','Back') + '<pre>' + name + '</pre>';
	const tpl = {title: 'Action', body: body}; 
	res.send(200, tpl);
});

aspa.use('/user', route);

aspa.get('/stat/', res => {
	aspa.auth('aspa','pass',res, (res) => {
	let body = '<h3>' + aspa.link('/',aspa.sign+' Uptime') + ': ';
	body += ts.time(Date.now() - $start) + '</h3>';
	const f = fs.stat();
	body += '<p><b>Cache</b><br />Timeout: ' + (aspa.opt.cache/1000);
	body += ' sec<br />Files: ' + f.size + '</p>';
	for(let [k,v] of f.entries()) body += aspa.link(k.replace($root,'')) + '<br />'; 
// logs		
	body += '<br /><h3>Logs: ' + $logs.length + ' lines</h3>';
	const clr = ['','','gray','green','red','blue'];
	let c, s;
	for (let l of $logs){
		c = Math.round(l.code/100);
		s = aspa.log2s(l);
		body += '<span style="color:'+clr[c]+'">' + s + '</span><br />';
	}
	const meta = '<meta http-equiv="refresh" content="30">' +
		'<link rel="icon" type="image/png" href="/favicon.png" />';
	aspa.send(res, 'Stats',body,meta);
	});
});

aspa.tpl('/',{title: () => { return Date.now(); }});
aspa.tpl('/index.html',{title: () => { return Date.now(); }});

aspa.log = (l) => {
	$logs.push(l);
	const s = aspa.log2s(l);
	const c = Math.round(l.code/100);
	if (c === 2)ts.println(s,ts.GRAY); 
	else if (c === 4)ts.println(s,ts.RED); 
	else if (c === 3)ts.println(s,ts.GREEN); 
	else ts.println(s,ts.ORANGE);
};

const $ip = aspa.ips()[0];

aspa.listen($port, $host, (err) => {  
	if (err) return ts.error(58,err);
	ts.info('Node.js: ' + process.version,'os: ' + process.platform,'arch: '+process.arch);
	ts.println(`Aspa server is running on http://${$ip}:${$port}`,ts.GREEN);
});
