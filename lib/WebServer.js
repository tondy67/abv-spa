/** 
 * Abvos SPA server
 */
"use strict";

// node --inspect server.js | Open 'about:inspect' in Chrome
// export DEBUG=abv:*,info / unset DEBUG
const ts = require('abv-ts')('abv:spa');
const Events = require('events');
const os = require('os');
const fs = require('fs');
const Path = require('path');
var crypto = require('crypto');
const http = require('http') ; 
const Response = require('./Response.js');
const Wallet = require('abv-wallet');

const $port = 8080;
const $host = '0.0.0.0';

const MAX_FILE_SIZE = 4194304; // 4 MB

const $addSlash = (url) => { 
	return url.endsWith('/') ? url : url + '/'; 
	};

const $etag = (str) => {
	return 'W/"'+crypto.createHash('md5').update(str).digest('hex')+'"';
	};

class WebServer extends Events
{
	constructor()
	{
		super();
		this.opt = new Map();
		this.tpls = new Map();
		this.defaults();
		this.cache = new Wallet(this.name);
		const me = this;

		this.server = http.createServer((req, res) => {
			if (req.method !== 'GET') return me.res(405,req.url).send(res);

			const path = req.url.split('?')[0];

			let r = me.open(path,req.url);

			if (r !== null){
				if (r.code !== 200){
					return r.send(res);
				}else if (!r.bin && me.tpls.has(path)){
					const obj = me.tpls.get(path);
					Object.keys(obj).forEach((key,index) => {
						r._body = r._body.replace('<%'+key+'%>',obj[key]);
					});
				}
				const etag = req.headers['if-none-match'];
				r.etag = r.bin ? $etag(path + r.size) : $etag(r.body);
		//		if (r.etag === etag)return me.res(304,req.url).send(res);
				return r.send(res);
			}
			const cb = me.listeners(path)[0];
			if (typeof cb === ts.FN) return me.emit(path,req,res);
			me.res(404,req.url).send(res);
		});

		this.server.on('error', (e) => { ts.error(68, e.stack); });
		this.on('error', (e) => { ts.error(69, e.stack); });
	}
	
	log(obj) { }
	
	res(code=200, url='', body='') 
	{ 
		const r = new Response(code,url,body); 
		r.log = (obj) => { this.log(obj); };
		return r;
	}
	
	stat(n) 
	{ 
		return Wallet.name(n); 
	}

	open(path,url)
	{
		let r = this.cache.get(path); 
		if (r !== null) return r;

		let p = this.get('root') + path;

		if (!fs.existsSync(p)) return r;

		p = fs.realpathSync(p);
		if (!p.startsWith(this.get('root'))){
			ts.error(64,'No symlinks outside of the root!');
			return this.res(400,url);
		}

		const stat = fs.lstatSync(p); 
		if (stat.isDirectory()){
			const dir = fs.readdirSync(p);

			let ix = '';	
			for (ix of this.get('index'))if (dir.includes(ix)) break;

			if (ix !== ''){
				 r = this.res(307, url);
				 r.redirect = $addSlash(path) + ix;
				 return r;
			}
			else return this.dirlist(p,dir);
		}
		
		r = this.res(200,url);

		if (stat.size < MAX_FILE_SIZE){

			try {
				r.body = fs.readFileSync(p);
				this.cache.set(path, r, this.get('cache'));
			}catch(e){
				ts.error(124,e.stack);
				r = null;
			}
		}else{
			r.stream = fs.createReadStream(p);
			r._size = stat.size;
		}
		
		return r;
	}
	
	dirlist(dir,files)
	{
		if (!files) files = [];
		const d = ['../'], f = [];
		for (let it of files){
			if (fs.lstatSync(dir+'/'+it).isDirectory()) d.push(it + '/');
			else f.push(it);
		}
		const p = dir.replace(this.get('root'),''); 
		return this.res(200,p,this.dirpage(p, d, f));
	}
	
	dirpage(dir, dirs, files)
	{
		const sep = '<br>\n', d = [], f = [];
		for (let it of dirs) d.push(this.link(Path.normalize(dir+'/'+it),it));
		for (let it of files) f.push(this.link(dir + '/' + it,it));
		const body = d.join(sep) + sep + f.join(sep);
		return this.page(dir, body);
	}
	
	defaults()
	{
		const root = Path.resolve(__dirname + '/../../');
		if (!this.get('root')) this.set('root', root); 
		if (!this.get('cache')) this.set('cache', 60);
		if (!this.get('index')) this.set('index',['index.htm','index.html']);
		const ix = this.get('index');
		if (ix[ix.length-1] !== '') ix.push('');
	}
	
	set(opt,val)
	{
		if (ts.is(opt,String)){
			if ((opt === 'port')||(opt === 'host')) return;
			if (opt === 'cache') val *= 1000;
			this.opt.set(opt,val);
			this.defaults();
		}
	}
	
	get(opt)
	{
		return this.opt.get(opt);
	}
	
	get name() { return Response.name; }
	
	tpl(url,obj)
	{
		if (ts.is(url,String)) this.tpls.set(url,obj);
	}
	
	link(url,name)
	{
		if (!url) return;
		if (!name) name = url;
		return '<a href="' + url + '">' + name + '</a>';
	}

	page(title='', body='', meta='')
	{
		const p = '<!DOCTYPE html>\n<html><head>\n<meta name="viewport" ' +
		'content="width=device-width, initial-scale=1">\n<title>' + title +
		'</title>' + meta + '\n</head>\n<body>\n' + body + '\n</body></html>';
		return p;
	}
	
	listen(port, host, callback)
	{
		if (!port || (port < 80)||(port > 9999)) port = $port;
		if (!host) host = $host;
		this.set('port',port);
		this.set('host',host);
		this.server.listen(port, host, 511, callback);
		return this.server;
	}
	
	ips()
	{
		const ifaces = os.networkInterfaces();
		const r = new Set();
		Object.keys(ifaces).forEach((ifname) => {
			let alias = 0;

			ifaces[ifname].forEach((iface) => {
				if ('IPv4' !== iface.family || iface.internal !== false) return;
				r.add(iface.address);
				++alias;
			});
		});
		return Array.from(r);
	}
	
}


module.exports = WebServer;
