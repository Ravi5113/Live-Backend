// Quick script to generate a secure session secret
// Run: node generate-secret.js

const crypto = require('crypto');
const secret = crypto.randomBytes(32).toString('hex');
console.log('\n🔐 Generated Session Secret:');
console.log(secret);
console.log('\n📋 Copy this and use it for SESSION_SECRET environment variable\n');

