/** 
 * Response
 */
"use strict";

const ts = require('abv-ts')('abv:spa.Response');
const Path = require('path');
const http = require('http') ; 
const mime = require('./mimetype.js');

const $name = 'Aspa';

class Response
{
	constructor(code=200, url='', body='')
	{
		this.code = code;
		this.mime = 'text/plain';
		this.time = ts.now;
		this.url = url;
		this.redirect = '';
		this.etag = null;
		this.bin = false;
		this.body = body;
		this.stream = null;
		this.size = null;
	}	
	
	static get name() { return $name; }
	
	get body(){ return this._body; }
	
	set body(v)
	{
		if (!(ts.is(v,Buffer) || ts.is(v,String) || ts.is(v,ArrayBuffer))){
			ts.error(31,'type?');
			this._body = '';
			return;
		}
		this.bin = v.includes('000','hex') ? true:false;
		const ext = Path.extname(this.url).substr(1);
		this.mime = mime(ext, v, this.bin); 
		this._body = this.bin ? v : v.toString();
	}

	get sizeof() 
	{ 
		return this.size ? this.size : Buffer.byteLength(this._body); 
	}		
	
	log(obj) {}
	
	send(res)
	{
		const code = this.code;
		this.time = ts.now;
		const header = {'X-Powered-By': $name};
		const l = {
			host:res.socket.remoteAddress,
			time:this.time,
			url:this.url,
			code:this.code,
			size:this.sizeof};
		l.etag = this.etag ? this.etag : '';
		this.log(l);

		if (code !== 200) this._body = http.STATUS_CODES[code];


		if ((code == 301)||(code == 303)||(code == 307)){
			header.Location = this.redirect;
			res.writeHead(code, header);
			return res.end();
		}else if (this.stream !== null){ 
			// just in case ;)
			this.stream.on('error', (err) => {
				res.writeHead(404, header);
				res.write('404: ' + http.STATUS_CODES[404]);
				res.end();
			});
			res.statusCode = 200;
			this.stream.pipe(res);
		}else{ 
			header['Content-Length'] = this.sizeof;
			header['Content-Type'] = this.mime;
			if (this.etag) header.Etag = this.etag;
			res.writeHead(code, header);
			return res.end(this._body);
		}
	}
	

}

module.exports = Response;
