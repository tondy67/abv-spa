/** 
 * Response
 */
"use strict";

const ts = require('abv-ts')('abv:spa.Response');
const http = require('http') ; 
const fs = require('abv-vfs');
const File = require('abv-vfs/File');

const $name = 'Aspa';

class Response extends File
{
	constructor(req, res)
	{
		super(req.url,'');
		this._req = req;
		this._res = res;
		this.method = req.method.toUpperCase();
		this.code = 200;
		this._url = '';//redirect;
		this.etag = null;
		this.stream = null;
	}	
	
	redirect(url, code=307) 
	{ 
		this._url = url; 
		this.code = code;
		return this;
	}
	
	apply(tpl)
	{
		let b = this._body;
		Object.keys(tpl).forEach((key,index) => {
			b = b.replace(new RegExp('<%'+key+'%>', 'g'), tpl[key]);
		});
		this.body = b;
	}
	
	send(code, tpl)
	{
		if (tpl) this.apply(tpl);
		code = code || this.code;
		this.time = ts.now;
		const header = {'X-Powered-By': $name};
		const l = {
			etag: this.etag || '',
			method: this.method,
			host:this._res.socket.remoteAddress,
			time:this.time,
			url:this.name,
			code:code,
			size:this.size};
		this.log(l);

		if (code !== 200) this.body = code+": "+http.STATUS_CODES[code];

		if (code === 401){
			header['WWW-Authenticate'] = 'Basic realm="' + $name + '" charset="UTF-8"';
			this._res.writeHead(code, header);
			this._res.end();
		}else if ((code === 301)||(code === 303)||(code === 307)){
			header.Location =  encodeURI(this._url);
			this._res.writeHead(code, header);
			return this._res.end();
		}else if (this.stream !== null){ 
			// just in case ;)
			this.stream.on('error', (err) => {
				this._res.writeHead(404, header);
				this._res.write('404: ' + http.STATUS_CODES[404]);
				this._res.end();
			});
			this._res.statusCode = 200;
			this.stream.pipe(this._res);
		}else{
			header['Content-Length'] = this.size;
			header['Content-Type'] = this.type;
			if (this.etag) header.Etag = this.etag;
			this._res.writeHead(code, header);
			return this._res.end(this._body);
		}
	}
	
	log(obj) {}
	
	static get sign() { return $name; }

}

module.exports = Response;
