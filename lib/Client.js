var
	inherits = require('util').inherits,
	EventEmitter = require('events').EventEmitter;

var
	http = require('http'),
	https = require('https'),
	querystring = require('querystring');

/** constructor **/

function Client(opts)
{
	if(!this instanceof Client)
		return new Client(opts);

	// copy options:
	this._host = opts.host || '192.168.1.1';
	this._port = opts.port || 443;
	this._ssl = ('ssl' in opts ? opts.ssl : (this._port != 80));
	this._username = opts.username || opts.user || 'admin';
	this._password = opts.password || opts.pass || '1234';
	this._disable_ssl_verification = ('disable_ssl_verification' in opts ? opts.disable_ssl_verification : true);

	// internal state vars:
	this._session = null;

	// internal objects:
	this._httpAgent = null;
}
inherits(Client, EventEmitter);

/** private methods **/

Client.prototype._httpRequestOptions = function(add_opts, post_data)
{
	if(!this._httpAgent && this._ssl)
		this._httpAgent = new https.Agent({ rejectUnauthorized: !this._disable_ssl_verification });
	else if(!this._httpAgent)
		this._httpAgent = new http.Agent();

	// options for http.request
	var opts = {
		hostname: this._host,
		port: this._port,
		agent: this._httpAgent,
	};

	if(typeof add_opts === 'object')
	{
		for(var prop in add_opts)
		{
			opts[prop] = add_opts[prop];
		}
	}

	if(!opts.headers)
		opts.headers = {};

	if(typeof post_data === 'string')
	{
		opts.method = 'POST';
		opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
		opts.headers['Content-Length'] = post_data.length;
	}

	if(this._session)
	{
		opts.headers['Cookie'] = this._session;
	}

	return opts;
};

Client.prototype._httpRequest = function(opts, callback)
{
	var self = this;

	var req = (self._ssl
		? https.request(opts, callback)
		: http.request(opts, callback));

	req.on('error', function(e) { self.emit('connection_error', e); });

	return req;
};

/** public API **/

Client.prototype.login = function(callback)
{
	var self = this;

	self._session = null;

	var post_data = querystring.stringify({
		username: self._username, password: self._password
	});

	var req_opts = self._httpRequestOptions({ path: '/' }, post_data),
		req = self._httpRequest(req_opts, function(res)
		{
			// success = 302 redirect with new cookie
			// fail = 200 and everything else

			res.emit('end'); // discard response body

			if(res.statusCode != 302 || !'set-cookie' in res.headers)
				return self.emit('login_failed');

			for(var i in res.headers['set-cookie'])
			{
				if(res.headers['set-cookie'][i].match(/^(authtok=.+?);/))
				{
					self._session = RegExp.$1;
					return callback();
				}
			}

			self.emit('login_failed');
		});
	req.write(post_data);
	req.end();
};

Client.prototype.logout = function(callback)
{
	var self = this;

	if(!self._session)
		return;

	var req_opts = self._httpRequestOptions({ path: '/setuser.cgi?perform=logout&_dc=' + Date.now() }),
		req = self._httpRequest(req_opts, function(res)
		{
			// success = 200 with some JSON blob
			// fail (session expired etc.) = 302 redirect and everything else

			self._session = null;
			callback(res.statusCode == 200);

			// don't keep waiting for new requests (keep alive) after logout:
			self._httpAgent = null;

			res.emit('end'); // discard response body
		});
	req.end();
};

Client.prototype.exec = function(commands, callback)
{
	commands = [].concat(commands);

	if(commands.length < 1)
		return;

	var self = this;

	var post_params = {
		filter: 'js2',
		write: 0,
	};

	// bit of weirdness here because there can be multiple
	// parameters with the same name ("cmd").

	if(commands.length == 1)
		post_params.cmd = commands[0];

	var post_data = querystring.stringify(post_params);

	if(commands.length > 1)
	{
		for(var i in commands)
		{
			post_data += '&cmd=' + querystring.escape(commands[i]);
		}
	}

	var req_opts = self._httpRequestOptions({ path: '/cgi-bin/zysh-cgi' }, post_data),
		req = self._httpRequest(req_opts, function(res)
		{
			var body = '', response = {};
			console.log(res.statusCode);

			res.on('data', function(chunk) { body += chunk; });
			res.on('end', function()
			{
				// extract!
				body.replace(/var zyshdata(\d+)=(.+?);\r?\nvar errno\1=(\d+);\r?\nvar errmsg\1=.(.+?).;/g,
					function(m, index, json, errno, errmsg)
					{
						// stupid ZyXEL is not sending actual JSON, but JS with single quotes...
						// this is a poor attempt at fixing that:
						json = json.replace(/"/g, '\\"', json);
						json = json.replace(/'/g, "\"", json);
						// another way would be the vm module, but that's potentially insecure, so doing it like this for now.
						response[commands[index]] = { data: JSON.parse(json), errno: errno, errmsg: errmsg };
					});
				callback(response);
			});
		});
	req.write(post_data);
	req.end();
};

module.exports = Client;
