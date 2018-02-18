/** 
 * Abvos SPA server
 */
"use strict";

// node --inspect server.js | Open 'about:inspect' in Chrome
// export DEBUG=abv:*,info / unset DEBUG
const ts = require('abv-ts')('abv:spa.WebServer');
const Events = require('events');
const fs = require('abv-vfs');
const Path = require('path');
const crypto = require('crypto');
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
	constructor(opt)
	{
		super();
		this.opt = opt ? opt : {};
		this.defaults();
		this.tpls = new Map();
		this.cache = new Wallet(this.sign);
		const me = this;

		this.server = http.createServer((req, res) => {
			const allowed = ['GET','POST'];
			const method = req.method.toUpperCase();
			if (!allowed.includes(method)) 
				return me.res(405,req.url).send(res);

			const path = req.url.split('?')[0];
			
			if (method === 'GET'){
				let r = me.open(path,req.url);

				if (r !== null){
					if (r.code !== 200){
						return r.send(res);
					}else if (!r.bin && me.tpls.has(path)){
						const tpl = me.tpls.get(path);
						r.apply(tpl);
					}
					const etag = req.headers['if-none-match'];
					r.etag = r.bin ? $etag(path + r.size) : $etag(r.body.substr(0,1024));
					if (r.etag === etag)return me.res(304,req.url).send(res);
					return r.send(res);
				}
			}
			// TODO: regex
			const cb = me.listeners(path)[0];
			if (typeof cb === ts.FN) return me.emit(path,req,res);
			me.res(404,req.url).send(res);
		});

		this.server.on('error', (e) => { ts.error(68, e); });
		this.on('error', (e) => { ts.error(69, e); });
	}
	
	log(obj) { }
	
	auth(user, pass, req, res, cb) 
	{
		let s = '', a;
		const r = new Response(); 
		const auth = req.headers.authorization; 
		if (auth){
			a = auth.split(' ');
			s = new Buffer(a[1], 'base64').toString('utf8');
			if (s === (user + ':' + pass)){
				if (typeof cb === ts.FN) return cb(req, res);
				r.body = 'logged';
				return r.send(res);
			}
		}
		r.code = 401;
		return r.send(res);
	}
	
	res(code=200, url='', body='', redirect='') 
	{ 
		const r = new Response(code, url, body, redirect); 
		r.log = (obj) => { this.log(obj); };
		return r;
	}
	
	stat(n) 
	{ 
		return Wallet.name(n); 
	}

	post(req,res)
	{
		return new Promise((resolve, reject) => {
			let body = '';
			const path = '';
			req.on('error', (err) => {
			  return reject(err);
			});
			req.on('data', (data)  => {
				body += data;
				if(body.length > 1e7) return reject(413);
			});
			req.on('end', ()  => {
				const ret = {body: body, path: path, params: {}};
				if (true){
					ret.params = this.query(body);
				}
				return resolve(ret);
			});
		});
	}
	
	query(str)
	{
		const r = {};
		str = str.replace('&amp;','&');
		const t = str.split('&');
		let a;
		for (let it of t){
			a = it.split('=');
			if (a[0]) a[0] = decodeURIComponent(a[0].trim()); 
			if (a[1]) a[1] = decodeURIComponent(a[1].trim());
			if (a[0] !== '') r[a[0]] = a[1];
		}
		return r;
	}
	
	open(path,url)
	{
		let r = this.cache.get(path); 
		if (r !== null) return r;

		let p = this.opt.root + path;

		if (!fs.existsSync(p)) return r;

		p = fs.realpathSync(p);
		if (!p.startsWith(this.opt.root)){
			ts.error(64,'No symlinks outside of the root!');
			return this.res(400,url);
		}

		const stat = fs.lstatSync(p); 
		if (stat.isDirectory()){
			const dir = fs.readdirSync(p);

			let ix = '';	
			for (ix of this.opt.index)if (dir.includes(ix)) break;

			return ix === '' ? this.dirlist(p,dir) :
				this.res(307, url, '', $addSlash(path) + ix);
		}
		
		r = this.res(200,url);

		if (stat.size < MAX_FILE_SIZE){
			try {
				r.body = fs.readFileSync(p); 
				this.cache.set(path, r, this.opt.cache);
			}catch(e){
				ts.error(176,e.stack);
				r = null;
			}
		}else{
			r.stream = fs.createReadStream(p);
			r.size = stat.size;
		}
		
		return r;
	}
	
	redirect(res, url, old='', code=307)
	{
		return this.res(code, old, '', url).send(res);
	}
	
	dirlist(dir,files)
	{
		if (!files) files = [];
		const d = ['../'], f = [];
		for (let it of files){
			if (fs.lstatSync(dir+'/'+it).isDirectory()) d.push(it + '/');
			else f.push(it);
		}
		const p = dir.replace(this.opt.root,''); 
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
		const root = __dirname + '/../../../';
		if (!this.opt.root) this.opt.root = root; 
		this.opt.root = Path.resolve(this.opt.root);

		if (!this.opt.cache) this.opt.cache = 60;
		this.opt.cache *= 1000;

		if (!this.opt.index) this.opt.index = ['index.htm','index.html'];
		const ix = this.opt.index;
		if (ix[ix.length-1] !== '') ix.push('');
	}
	
	get sign() { return Response.sign; }
	
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
	
	send(req, res, title='', body='', meta='')
	{
		return this.res(200, req.url, this.page(title,body,meta)).send(res);
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
		if (!port || (port < 80)||(port > 65535)) port = $port;
		if (!host) host = $host;
		this.opt.port = port;
		this.opt.host = host;
		this.server.listen(port, host, 511, callback);
		return this.server;
	}
	
	ips()
	{
		return fs.IPs();
	}
	
}


module.exports = WebServer;
