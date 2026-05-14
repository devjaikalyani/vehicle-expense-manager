const express = require('express');
const webPush = require('web-push');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function initVapid() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webPush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'admin@ritewater.in'}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    return true;
  }
  return false;
}
initVapid();

router.get('/vapid-public-key', (_req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

router.post('/subscribe', authenticateToken, async (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'Subscription object required' });
  try {
    await db.query(
      `INSERT INTO push_subscriptions (user_id, subscription)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET subscription = $2, created_at = NOW()`,
      [req.user.id, JSON.stringify(subscription)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/subscribe', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM push_subscriptions WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function sendPushToUser(userId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  try {
    const result = await db.query(
      'SELECT subscription FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );
    if (!result.rows[0]) return;
    await webPush.sendNotification(result.rows[0].subscription, JSON.stringify(payload));
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await db.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
    }
  }
}

module.exports = { router, sendPushToUser };
