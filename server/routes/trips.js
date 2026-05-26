const express = require('express');
const db = require('../db');
const { authenticateToken, requireManager } = require('../middleware/auth');
const { sendPushToUser } = require('./push');

const router = express.Router();

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function calcGpsKmFromTracks(tripId) {
  const r = await db.query(
    'SELECT latitude, longitude FROM gps_tracks WHERE trip_id = $1 ORDER BY timestamp ASC',
    [tripId]
  );
  const pts = r.rows;
  if (pts.length < 2) return null;
  let km = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = haversineKm(
      parseFloat(pts[i - 1].latitude), parseFloat(pts[i - 1].longitude),
      parseFloat(pts[i].latitude), parseFloat(pts[i].longitude)
    );
    if (d < 0.5) km += d; // ignore jumps over 500 m (GPS noise)
  }
  return Math.round(km * 100) / 100;
}

router.post('/start', authenticateToken, async (req, res) => {
  const { vehicle_id, purpose, start_odometer, start_lat, start_lng, start_address } = req.body;
  try {
    const active = await db.query(
      "SELECT id FROM trips WHERE employee_id = $1 AND status = 'active'",
      [req.user.id]
    );
    if (active.rows.length > 0) {
      return res.status(400).json({ error: 'You already have an active trip. Please end it first.' });
    }
    const result = await db.query(
      `INSERT INTO trips (employee_id, vehicle_id, purpose, start_time, start_odometer, start_lat, start_lng, start_address, status)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, 'active') RETURNING *`,
      [req.user.id, vehicle_id || null, purpose || null, start_odometer || null, start_lat || null, start_lng || null, start_address || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/end/:id', authenticateToken, async (req, res) => {
  const { end_odometer, end_lat, end_lng, end_address, gps_distance_km } = req.body;
  try {
    const tripResult = await db.query(
      'SELECT * FROM trips WHERE id = $1 AND employee_id = $2',
      [req.params.id, req.user.id]
    );
    const trip = tripResult.rows[0];
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.status !== 'active') return res.status(400).json({ error: 'Trip is not active' });

    const manual_km =
      trip.start_odometer != null && end_odometer != null
        ? Math.max(0, parseFloat(end_odometer) - parseFloat(trip.start_odometer))
        : null;

    // Use client-provided GPS km, or fall back to server-side calculation from stored tracks
    const resolvedGpsKm =
      gps_distance_km != null && parseFloat(gps_distance_km) > 0
        ? parseFloat(gps_distance_km)
        : await calcGpsKmFromTracks(req.params.id);

    const result = await db.query(
      `UPDATE trips
       SET end_time = NOW(), end_odometer = $1, end_lat = $2, end_lng = $3, end_address = $4,
           manual_distance_km = $5, gps_distance_km = $6, status = 'pending'
       WHERE id = $7 RETURNING *`,
      [end_odometer || null, end_lat || null, end_lng || null, end_address || null,
       manual_km, resolvedGpsKm, req.params.id]
    );
    if (req.liveLocations) {
      req.liveLocations.delete(String(req.user.id));
      req.io.emit('gps:locations', Object.fromEntries(req.liveLocations));
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/active', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, v.name AS vehicle_name, v.type AS vehicle_type, v.registration_number
       FROM trips t LEFT JOIN vehicles v ON t.vehicle_id = v.id
       WHERE t.employee_id = $1 AND t.status = 'active'`,
      [req.user.id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, u.name AS employee_name, u.employee_code,
       v.name AS vehicle_name, v.type AS vehicle_type, v.registration_number
       FROM trips t
       JOIN users u ON t.employee_id = u.id
       LEFT JOIN vehicles v ON t.vehicle_id = v.id
       WHERE t.id = $1 AND (t.employee_id = $2 OR $3 IN ('manager', 'admin'))`,
      [req.params.id, req.user.id, req.user.role]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Trip not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { employee_id, date } = req.query;
    const base = `SELECT t.*, u.name AS employee_name, u.employee_code,
                  v.name AS vehicle_name, v.type AS vehicle_type, v.registration_number
                  FROM trips t
                  JOIN users u ON t.employee_id = u.id
                  LEFT JOIN vehicles v ON t.vehicle_id = v.id`;

    const where = [];
    const params = [];

    if (req.user.role === 'manager' || req.user.role === 'admin') {
      if (employee_id) { params.push(parseInt(employee_id, 10)); where.push(`t.employee_id = $${params.length}`); }
    } else {
      params.push(req.user.id); where.push(`t.employee_id = $${params.length}`);
    }
    if (date) { params.push(date); where.push(`DATE(t.start_time) = $${params.length}`); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderCol = date ? 'start_time' : 'created_at';
    const order = date ? 'ASC' : 'DESC';
    const limit = date ? '' : (req.user.role === 'manager' || req.user.role === 'admin') ? 'LIMIT 500' : 'LIMIT 200';
    const result = await db.query(`${base} ${whereClause} ORDER BY t.${orderCol} ${order} ${limit}`, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/approve', authenticateToken, requireManager, async (req, res) => {
  const { manager_notes } = req.body;
  try {
    const result = await db.query(
      `UPDATE trips SET status = 'approved', manager_notes = $1, approved_by = $2, approved_at = NOW()
       WHERE id = $3 AND status = 'pending' RETURNING *`,
      [manager_notes || null, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Trip not found or not pending' });
    const trip = result.rows[0];
    sendPushToUser(trip.employee_id, {
      title: 'Trip Approved',
      body: `Your trip "${trip.purpose || 'Trip'}" has been approved.`,
    });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/reject', authenticateToken, requireManager, async (req, res) => {
  const { manager_notes } = req.body;
  try {
    const result = await db.query(
      `UPDATE trips SET status = 'rejected', manager_notes = $1, approved_by = $2, approved_at = NOW()
       WHERE id = $3 AND status = 'pending' RETURNING *`,
      [manager_notes || null, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Trip not found or not pending' });
    const trip = result.rows[0];
    sendPushToUser(trip.employee_id, {
      title: 'Trip Rejected',
      body: `Your trip "${trip.purpose || 'Trip'}" was rejected. Note: ${manager_notes || 'No reason given.'}`,
    });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk approve or reject multiple pending trips at once
router.patch('/bulk-action', authenticateToken, requireManager, async (req, res) => {
  const { tripIds, action, manager_notes } = req.body;
  if (!Array.isArray(tripIds) || tripIds.length === 0) {
    return res.status(400).json({ error: 'tripIds[] is required' });
  }
  if (tripIds.length > 100) {
    return res.status(400).json({ error: 'Max 100 trips per bulk action' });
  }
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be approve or reject' });
  }
  const status = action === 'approve' ? 'approved' : 'rejected';
  try {
    const result = await db.query(
      `UPDATE trips SET status = $1, manager_notes = $2, approved_by = $3, approved_at = NOW()
       WHERE id = ANY($4::int[]) AND status = 'pending' RETURNING *`,
      [status, manager_notes || null, req.user.id, tripIds]
    );
    for (const trip of result.rows) {
      sendPushToUser(trip.employee_id, {
        title: status === 'approved' ? 'Trip Approved' : 'Trip Rejected',
        body: `Your trip "${trip.purpose || 'Trip'}" has been ${status}.`,
      });
    }
    res.json({ updated: result.rowCount, trips: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
