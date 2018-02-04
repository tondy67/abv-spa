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
	constructor(code=200, url='', body='')
	{
		super(url,body);
		this.code = code;
		this._url = '';
		this.etag = null;
		this.stream = null;
	}	
	
	redirect(url) { this._url = url; }
	
	send(res)
	{
		const code = this.code;
		this.time = ts.now;
		const header = {'X-Powered-By': $name};
		const l = {
			host:res.socket.remoteAddress,
			time:this.time,
			url:this.name,
			code:this.code,
			size:this.size};
		l.etag = this.etag ? this.etag : '';
		this.log(l);

		if (code !== 200) this._body = http.STATUS_CODES[code];

		if (code === 401){
			header['WWW-Authenticate'] = 'Basic realm="' + $name + '" charset="UTF-8"';
			res.writeHead(code, header);
			res.end();
		}else if ((code === 301)||(code === 303)||(code === 307)){
			header.Location = this._url;
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
			header['Content-Length'] = this.size;
			header['Content-Type'] = this.type;
			if (this.etag) header.Etag = this.etag;
			res.writeHead(code, header);
			return res.end(this._body);
		}
	}
	
	log(obj) {}
	
	static get sign() { return $name; }

}

module.exports = Response;
