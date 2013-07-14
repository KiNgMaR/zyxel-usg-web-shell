Description
===========
Node.js module that allows communication with ZyXEL's USG series firewalls.

It allows logging in, sending "zysh" commands, and logging out. Commands are sent via HTTP(s).

Requirements
============

* [node.js](http://nodejs.org/) -- v0.9.0 or newer

Example
========

```javascript
var
	zysh_client = require('zyxel-usg-web-shell');

var zysh = new zysh_client({
	host: '192.168.1.1',
	port: 443,
	user: 'readonly',
	password: 'foobaz'
});

zysh.on('connection_error', function(e)
{
	// e is just error object from node's HTTP module.
	console.log(e);
});

zysh.on('login_failed', function()
{
	console.log('LOGIN FAILED');
});

zysh.login(function() {
	console.log('LOGIN SUCCESSFULL');

	// execute some commands:
	zysh.exec([ 'show interface _all', 'show report status', 'show interface-name', 'show report wan2 service' ],
		function(response)
		{
			console.log('CMD CALLBACK: ', response);

			if('show interface-name' in response)
			{
				console.log('Interface names:');
				console.log(response['show interface-name'].data);
				/* Example output from USG-50:
				[ { _No_: '1', _System_Name: 'ge1', _User_Defined_Name: 'wan1' },
					{ _No_: '2', _System_Name: 'ge2', _User_Defined_Name: 'wan2' },
					{ _No_: '3', _System_Name: 'ge3', _User_Defined_Name: 'lan1' },
					{ _No_: '4', _System_Name: 'ge4', _User_Defined_Name: 'lan2' },
					{ _No_: '5', _System_Name: 'ge5', _User_Defined_Name: 'dmz' } ]
				*/
			}

			// then logout:
			zysh.logout(function(success) {
				console.log('LOGOUT CALLBACK: ' + success);
			});
		});
});
```

API
========

TBD
