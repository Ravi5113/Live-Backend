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

    console.log('\n== CREATE RIDE ==');
    const rideBody = JSON.stringify({ pickup: { lat: 0, lng: 0 }, drop: { lat: 1, lng: 1 }, fare: 10 });
    const rideOpts = { hostname: 'localhost', port: 3004, path: '/api/rides', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(rideBody) } };
    if (cookieHeader) rideOpts.headers['Cookie'] = cookieHeader;
    const ride = await request(rideOpts, rideBody);
    console.log('STATUS', ride.res.statusCode);
    console.log(ride.body);

    console.log('\n== CREATE TRANSACTION ==');
    const txBody = JSON.stringify({ userId: JSON.parse(login.body).data.id, amount: 50, type: 'credit', description: 'smoke credit' });
    const txOpts = { hostname: 'localhost', port: 3004, path: '/api/transactions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(txBody) } };
    if (cookieHeader) txOpts.headers['Cookie'] = cookieHeader;
    const tx = await request(txOpts, txBody);
    console.log('STATUS', tx.res.statusCode);
    console.log(tx.body);

    console.log('\n== GET WALLET ==');
    const walletOpts = { hostname: 'localhost', port: 3004, path: `/api/wallet/${JSON.parse(login.body).data.id}`, method: 'GET', headers: {} };
    if (cookieHeader) walletOpts.headers['Cookie'] = cookieHeader;
    const wallet = await request(walletOpts);
    console.log('STATUS', wallet.res.statusCode);
    console.log(wallet.body);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
