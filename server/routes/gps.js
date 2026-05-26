const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const gpsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many GPS updates. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/track', authenticateToken, gpsLimiter, async (req, res) => {
  const { trip_id, latitude, longitude, speed } = req.body;
  if (!trip_id || latitude == null || longitude == null) {
    return res.status(400).json({ error: 'trip_id, latitude, longitude required' });
  }
  try {
    await db.query(
      'INSERT INTO gps_tracks (trip_id, latitude, longitude, speed, timestamp) VALUES ($1, $2, $3, $4, NOW())',
      [trip_id, latitude, longitude, speed ?? 0]
    );
    req.io.emit('gps:update', {
      userId: req.user.id,
      name: req.user.name,
      tripId: trip_id,
      lat: latitude,
      lng: longitude,
      speed: speed ?? 0,
      timestamp: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/trip/:tripId', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM gps_tracks WHERE trip_id = $1 ORDER BY timestamp ASC',
      [req.params.tripId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
