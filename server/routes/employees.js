const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken, requireManager } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, requireManager, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, role, employee_code, phone, custom_rate_inr_per_km, created_at
       FROM users ORDER BY name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticateToken, requireManager, async (req, res) => {
  const { name, email, password, role, employee_code, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role, employee_code, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, employee_code, phone`,
      [name, email.toLowerCase(), hash, role || 'employee', employee_code || null, phone || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Set custom per-km rate for an employee (null to revert to vehicle-type default)
router.patch('/:id/rate', authenticateToken, requireManager, async (req, res) => {
  const { custom_rate_inr_per_km } = req.body;
  const rate = custom_rate_inr_per_km != null && custom_rate_inr_per_km !== '' ? parseFloat(custom_rate_inr_per_km) : null;
  if (rate != null && (isNaN(rate) || rate < 0)) {
    return res.status(400).json({ error: 'Rate must be a non-negative number' });
  }
  try {
    const result = await db.query(
      `UPDATE users SET custom_rate_inr_per_km = $1
       WHERE id = $2 RETURNING id, name, custom_rate_inr_per_km`,
      [rate, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Employee not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vehicles
router.get('/vehicles', authenticateToken, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'manager' || req.user.role === 'admin') {
      query = `SELECT v.*, u.name AS assigned_to_name
               FROM vehicles v LEFT JOIN users u ON v.assigned_to = u.id ORDER BY v.name`;
      params = [];
    } else {
      query = `SELECT v.*, u.name AS assigned_to_name
               FROM vehicles v LEFT JOIN users u ON v.assigned_to = u.id
               WHERE v.assigned_to = $1 OR v.assigned_to IS NULL ORDER BY v.name`;
      params = [req.user.id];
    }
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/vehicles', authenticateToken, requireManager, async (req, res) => {
  const { name, registration_number, type, assigned_to } = req.body;
  if (!name || !registration_number) return res.status(400).json({ error: 'Name and registration number required' });
  try {
    const result = await db.query(
      `INSERT INTO vehicles (name, registration_number, type, assigned_to)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, registration_number.toUpperCase(), type || 'two_wheeler', assigned_to || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Registration number already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/vehicles/:id', authenticateToken, requireManager, async (req, res) => {
  try {
    await db.query('DELETE FROM vehicles WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
