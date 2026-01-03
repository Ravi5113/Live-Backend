const http = require('http');
const fs = require('fs');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ res, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  try {
    const loginBody = fs.readFileSync('login.json', 'utf8');
    console.log('== LOGIN ==');
    const loginOpts = {
      hostname: 'localhost', port: 3004, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) }
    };
    const login = await request(loginOpts, loginBody);
    console.log('STATUS', login.res.statusCode);
    console.log(login.body);
    const setCookie = login.res.headers['set-cookie'];
    const cookieHeader = setCookie ? setCookie.map(c => c.split(';')[0]).join('; ') : '';

    console.log('\n== LIST TICKETS ==');
    const listOpts = { hostname: 'localhost', port: 3004, path: '/api/support/tickets', method: 'GET', headers: {} };
    if (cookieHeader) listOpts.headers['Cookie'] = cookieHeader;
    const list = await request(listOpts);
    console.log('STATUS', list.res.statusCode);
    console.log(list.body);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
