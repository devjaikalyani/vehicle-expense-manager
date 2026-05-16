const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');
const querystring = require('querystring');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// In-memory OTP store: email -> { otp, expiry }
const otpStore = new Map();
// In-memory verified store: token -> { email, expiry }
const verifiedStore = new Map();

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getZohoAccessToken() {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id:     process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type:    'refresh_token',
    });
    const req = https.request({
      hostname: 'accounts.zoho.in',
      path:     '/oauth/v2/token',
      method:   'POST',
      headers:  { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) resolve(json.access_token);
          else reject(new Error(json.error || 'Token refresh failed'));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function sendZohoMail(to, subject, html) {
  const accessToken = await getZohoAccessToken();

  // Get account ID
  const accountId = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'mail.zoho.in',
      path:     '/api/accounts',
      method:   'GET',
      headers:  { Authorization: `Zoho-oauthtoken ${accessToken}` },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.data[0].accountId);
        } catch (e) { reject(new Error('Could not get Zoho account ID')); }
      });
    });
    req.on('error', reject);
    req.end();
  });

  // Send email
  await new Promise((resolve, reject) => {
    const body = JSON.stringify({
      fromAddress: process.env.SMTP_USER,
      toAddress:   to,
      subject,
      content:     html,
      mailFormat:  'html',
    });
    const req = https.request({
      hostname: 'mail.zoho.in',
      path:     `/api/accounts/${accountId}/messages`,
      method:   'POST',
      headers:  {
        Authorization:  `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.status && json.status.code === 200) resolve();
        else reject(new Error(JSON.stringify(json)));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, employee_code: user.employee_code },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, employee_code: user.employee_code },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send OTP to email (for both forgot-password and first-time setup)
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const otp = generateOTP();
    otpStore.set(email.toLowerCase(), { otp, expiry: Date.now() + 10 * 60 * 1000 });

    const otpHtml = `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:16px;">
        <h2 style="color:#4f46e5;margin:0 0 8px;">Vehicle Expense Manager</h2>
        <p style="color:#64748b;margin:0 0 24px;font-size:14px;">Your one-time verification code</p>
        <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;">
          <div style="font-size:36px;font-weight:800;letter-spacing:10px;color:#1e293b;">${otp}</div>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin-top:20px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      </div>`;

    if (process.env.ZOHO_REFRESH_TOKEN) {
      await sendZohoMail(email, 'Your OTP - Vehicle Expense Manager', otpHtml);
    } else {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: 'smtp.zoho.in',
        port: 465,
        secure: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false },
      });
      await transporter.sendMail({ from: process.env.SMTP_FROM, to: email, subject: 'Your OTP - Vehicle Expense Manager', html: otpHtml });
    }

    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('Send OTP error:', err.message);
    res.status(500).json({ error: 'Failed to send OTP: ' + err.message });
  }
});

// Verify OTP — returns a short-lived token to authorize password reset
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

  const stored = otpStore.get(email.toLowerCase());
  if (!stored) return res.status(400).json({ error: 'No OTP requested for this email' });
  if (Date.now() > stored.expiry) {
    otpStore.delete(email.toLowerCase());
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }
  if (stored.otp !== otp.trim()) return res.status(400).json({ error: 'Incorrect OTP' });

  otpStore.delete(email.toLowerCase());

  const { mode } = req.body; // 'forgot' | 'setup'
  const resetToken = jwt.sign({ email: email.toLowerCase(), purpose: 'reset', mode: mode || 'forgot' }, process.env.JWT_SECRET, { expiresIn: '15m' });
  verifiedStore.set(resetToken, { email: email.toLowerCase(), expiry: Date.now() + 15 * 60 * 1000 });

  res.json({ resetToken });
});

// Reset password using verified reset token
router.post('/reset-password', async (req, res) => {
  const { resetToken, new_password } = req.body;
  if (!resetToken || !new_password) return res.status(400).json({ error: 'Token and new password are required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    if (payload.purpose !== 'reset') return res.status(400).json({ error: 'Invalid reset token' });

    const stored = verifiedStore.get(resetToken);
    if (!stored || Date.now() > stored.expiry) return res.status(400).json({ error: 'Reset session expired. Please start again.' });

    const hash = await bcrypt.hash(new_password, 10);
    const userCheck = await db.query('SELECT id FROM users WHERE email=$1', [payload.email]);

    if (!userCheck.rows[0]) {
      if (payload.mode !== 'setup') {
        return res.status(404).json({ error: 'No account found with this email.' });
      }
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'Full name is required to create your account.' });
      await db.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
        [name.trim(), payload.email, hash, 'employee']
      );
    } else {
      await db.query('UPDATE users SET password_hash=$1 WHERE email=$2', [hash, payload.email]);
    }

    verifiedStore.delete(resetToken);
    res.json({ message: payload.mode === 'setup' && !userCheck.rows[0] ? 'Account created! You can now sign in.' : 'Password updated successfully' });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Reset session expired. Please start again.' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, employee_code, phone FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/profile', authenticateToken, async (req, res) => {
  const { name, phone } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = await db.query(
      'UPDATE users SET name=$1, phone=$2 WHERE id=$3 RETURNING id, name, email, role, employee_code, phone',
      [name.trim(), phone?.trim() || null, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/password', authenticateToken, async (req, res) => {
  const { new_password } = req.body;
  if (!new_password) return res.status(400).json({ error: 'New password is required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  try {
    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
