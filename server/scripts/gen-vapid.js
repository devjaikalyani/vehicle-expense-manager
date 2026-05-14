// Run once to generate VAPID keys for push notifications.
// Then copy the output into server/.env and client/.env
// Usage: node scripts/gen-vapid.js
const webPush = require('web-push');
const keys = webPush.generateVAPIDKeys();
console.log('');
console.log('Add to server/.env:');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_EMAIL=admin@ritewater.in`);
console.log('');
console.log('Add to client/.env:');
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log('');
