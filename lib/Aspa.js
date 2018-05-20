/** 
 * Abvos SPA web server
 */
"use strict";

// node --inspect server.js | Open 'about:inspect' in Chrome
// export DEBUG=abv:*,info / unset DEBUG
const ts = require('abv-ts')('abv:spa.Aspa');
const Events = require('abv-events');
const fs = require('abv-vfs');
const Path = require('path');
const crypto = require('crypto');
const http = require('http') ; 
const Response = require('./Response.js');
const Router = require('./Router.js');
//const Wallet = require('abv-wallet');
//const MAX_FILE_SIZE = 4194304; // 4 MB

const $port = 8080;
const $host = '0.0.0.0';

const $etag = (s) => {
	return 'W/"' + crypto.createHash('md5').update(s).digest('hex') + '"';
};

const GET = 'GET';
const POST = 'POST';

class Aspa extends Events
{
	constructor()
	{
		super();
		this.defaults();
		this.tpls = new Map();
		fs.cache();
		const me = this;

		this.server = http.createServer((req, res) => {
			const allowed = [GET, POST];
			const r = new Response(req, res); 
			r.log = (obj) => { this.log(obj); };

			if (!allowed.includes(r.method)) 
				return r.send(405);

			const path = ts.rs(req.url.split('?')[0]);
			
			if (r.method === GET){	
				me.open(path,r);

				if (r.code === -1){
					r.code = 200;
				}else{
					if (r.code !== 200){
						return r.send();
					}else if (!r.bin && me.tpls.has(path)){
						const tpl = me.tpls.get(path);
						r.apply(tpl);
					}
				
					const etag = req.headers['if-none-match'];
					r.etag = ts.is(r.body,String) ? 
						$etag(r.body.substr(0,1048576)):$etag(path + r.size);
					if (r.etag === etag) return r.send(304);
					return r.send();
				}
			}
	
			if (!me.emit(path,r)){
				me.all(path,r);
				r.send(404);
			}
		});

		this.server.on('error', (e) => { ts.error(68, e); });
		this.on('error', (e) => { ts.error(69, e); });
	}
	
	all(path,res) { }
	
	log(obj) { }

	log2s(l) 
	{ 
		if (!l) return '';
		const r = ' ' + (l.host||'')  + ' [' + (new Date(l.time).toUTCString()) + 
			'] "' + (l.method||'') + ' ' + (l.url||'') + '" '+ (l.code||'') +
			' ' + (l.size||'');
		return r;
	}
	
	auth(user, pass, res, cb) 
	{
		let s = '', a;
		const auth = res._req.headers.authorization; 
		if (auth){
			a = auth.split(' ');
			s = new Buffer(a[1], 'base64').toString('utf8');
			if (s === (user + ':' + pass)){
				if (typeof cb === ts.FN) return cb(res);
				res.body = 'logged';
				return res.send();
			}
		}
		return res.send(401);
	}
	
	use(url, router) 
	{ 
		if (!ts.is(router, Router)) return ts.error(109, 'Router?');
		router.enable(this, url);
	}
	
	router()
	{
		return new Router();
	}
	
	set(opt, val)
	{
		if (val && ts.is(opt,String)){
			this.opt[opt] = val;
			this.defaults();
		}
	}
	
	_get(opt)
	{
		return this.opt[opt];
	}
	
	get(url, cb)
	{
		if (!cb) return this._get(url);
		this.on(url, res => {
			if (res.method !== GET) return res.send(405);
			cb(res);
		});
	}
	
	post(url, cb)
	{
		this.on(url, res => {
			if (res.method !== POST) return res.send(405);
			this._post(res._req, res._res).then(post => {
				cb(res, post);
			}).catch(err => { 
				ts.error(err);
				if (err !== 413) res.send(); else res.send(413);
			});
		});
	}

	_post(req,res)
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
		try{
			str = str.replace('&amp;','&');
			const t = str.split('&');
			let a;
			for (let it of t){
				a = it.split('=');
				if (a[0]) a[0] = decodeURIComponent(a[0].trim()); 
				if (a[1]) a[1] = decodeURIComponent(a[1].trim().replace(/\+/g,' '));
				if (a[0] !== '') r[a[0]] = a[1];
			}
		}catch(e){}
		return r;
	}
	
	open(path, r)
	{
		try{ path = decodeURI(path); }catch(e){}

		let p = this.opt.root + path;

		if (!fs.existsSync(p)){
			r.code = -1;
			return r;
		}

		p = fs.realpathSync(p);
		if (!p.startsWith(this.opt.root)){
			ts.error(200,'No symlinks outside of the root!');
			r.code = 400;
			return r;
		}

		const stat = fs.lstatSync(p);
		if (stat.isDirectory()){	
			const dir = fs.readdirSync(p);

			let ix = '';	
			for (ix of this.opt.index) if (dir.includes(ix)) break;

			if (ix === '') this.dirlist(p, dir, r);
			else if (!path.endsWith('/')) return this.redirect(r,ts.add(path,'/'),301);
			else r.body = fs.readFileSync(p + '/' + ix);
			return r;
		}
		
		if (stat.size < fs.MAX_FILE_SIZE){
			try {
				r.body = fs.readFileSync(p, null, this.opt.cache); 
			}catch(e){
				ts.error(228,e);
			}
		}else{
			r.stream = fs.createReadStream(p);
			r.size = stat.size;
		}
		
		return r;
	}
	
	redirect(res, url, code=307)
	{
		return res.redirect(url,code).send();
	}
	
	dirlist(dir, files, res)
	{
		if (!files) files = [];
		const d = ['../'], f = [];
		for (let it of files){
			if (fs.lstatSync(dir+'/'+it).isDirectory()) d.push(it + '/');
			else f.push(it);
		}

		const p = dir.replace(this.opt.root,''); 
		res.body = this.dirpage(p, d, f);
		return res;
	}
	
	dirpage(dir, dirs, files)
	{
		const sep = '<br />\n', d = [], f = [];
		for (let it of dirs) d.push(this.link(Path.normalize(dir+'/'+it),it));
		for (let it of files) f.push(this.link(dir + '/' + it,it));
		const body = d.join(sep) + sep + f.join(sep);
		return this.page(dir, body);
	}
	
	defaults()
	{
		if (!this.opt) this.opt = {}; 
		const root = __dirname + '/../../../';
		if (!this.opt.root) this.opt.root = root; 
		this.opt.root = Path.resolve(this.opt.root);

		if (!this.opt.cache) this.opt.cache = 60000;

		if (!this.opt.index) this.opt.index = ['index.html','index.xhtml','index.htm'];
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
	
	send(res, title='', body='', meta='')
	{
		res.body = this.page(title,body,meta);
		return res.send();
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


module.exports = Aspa;
