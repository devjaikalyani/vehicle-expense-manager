const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `trip-${req.params.tripId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpe?g|png|gif|webp|pdf)$/i;
    const mime = /^(image\/(jpeg|png|gif|webp)|application\/pdf)$/;
    if (allowed.test(path.extname(file.originalname)) && mime.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG, GIF, WebP) and PDFs are allowed'));
    }
  },
});

// Upload receipts for a trip (employee must own the trip)
router.post('/:tripId', authenticateToken, (req, res, next) => {
  upload.array('receipts', 6)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const tripCheck = await db.query(
      'SELECT id FROM trips WHERE id = $1 AND employee_id = $2',
      [req.params.tripId, req.user.id]
    );
    if (!tripCheck.rows[0]) {
      (req.files || []).forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
      return res.status(403).json({ error: 'Trip not found or access denied' });
    }
    const inserted = [];
    for (const file of req.files || []) {
      const result = await db.query(
        'INSERT INTO trip_receipts (trip_id, filename, original_name) VALUES ($1, $2, $3) RETURNING *',
        [req.params.tripId, file.filename, file.originalname]
      );
      inserted.push(result.rows[0]);
    }
    res.json(inserted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all receipts for a trip
router.get('/:tripId', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM trip_receipts WHERE trip_id = $1 ORDER BY uploaded_at',
      [req.params.tripId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a single receipt (employee must own the trip)
router.delete('/:tripId/:receiptId', authenticateToken, async (req, res) => {
  try {
    const tripCheck = await db.query(
      'SELECT id FROM trips WHERE id = $1 AND employee_id = $2',
      [req.params.tripId, req.user.id]
    );
    if (!tripCheck.rows[0]) return res.status(403).json({ error: 'Access denied' });

    const result = await db.query(
      'DELETE FROM trip_receipts WHERE id = $1 AND trip_id = $2 RETURNING filename',
      [req.params.receiptId, req.params.tripId]
    );
    if (result.rows[0]) {
      const filePath = path.join(UPLOAD_DIR, result.rows[0].filename);
      try { fs.unlinkSync(filePath); } catch {}
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
