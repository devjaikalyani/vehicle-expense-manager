// Exchange a Zoho Self-Client authorization code for a refresh token.
//
// HOW TO GET THE CODE:
//   1. Go to https://api-console.zoho.in
//   2. Click your app → "Self Client" tab
//   3. Scope: ZohoMail.messages.CREATE,ZohoMail.accounts.READ
//   4. Time Duration: 10 minutes
//   5. Click "Create" → copy the code shown
//   6. Run immediately: node scripts/get-zoho-token.js <paste-code-here>
//
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');
const querystring = require('querystring');

const code = process.argv[2];
if (!code) {
  console.error('\nUsage: node scripts/get-zoho-token.js <authorization-code>\n');
  console.error('Get the code from https://api-console.zoho.in → Self Client tab\n');
  process.exit(1);
}

const CLIENT_ID     = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost:3002/callback';

const postData = querystring.stringify({
  code,
  client_id:     CLIENT_ID,
  client_secret: CLIENT_SECRET,
  grant_type:    'authorization_code',
});

const options = {
  hostname: 'accounts.zoho.in',
  path:     '/oauth/v2/token',
  method:   'POST',
  headers: {
    'Content-Type':   'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData),
  },
};

console.log('\nExchanging code for tokens...\n');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const tokens = JSON.parse(data);
      if (tokens.error) {
        console.error('Error:', tokens.error, '-', tokens.error_description || '');
        console.error('(Code may have expired — generate a fresh one from Self Client)\n');
        process.exit(1);
      }
      console.log('=== SUCCESS — Add these to server/.env ===\n');
      console.log(`ZOHO_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('\nThen restart the server.\n');
    } catch (e) {
      console.error('Unexpected response:', data);
    }
  });
});

req.on('error', e => console.error('Request failed:', e.message));
req.write(postData);
req.end();
