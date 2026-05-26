const express = require('express');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { authenticateToken, requireManager } = require('../middleware/auth');

const router = express.Router();

const BLUE = '#1e40af';
const DARK = '#0f172a';
const LIGHT_BLUE = '#dbeafe';
const GREY = '#f1f5f9';
const BORDER = '#e2e8f0';

function drawRect(doc, x, y, w, h, fillColor, strokeColor) {
  doc.rect(x, y, w, h);
  if (fillColor) doc.fillColor(fillColor);
  if (strokeColor) { doc.strokeColor(strokeColor).fillAndStroke(); }
  else { doc.fill(); }
}

function tableHeader(doc, headers, widths, x0) {
  const y = doc.y;
  const totalW = widths.reduce((a, b) => a + b, 0);
  drawRect(doc, x0, y, totalW, 20, BLUE);
  doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
  let x = x0;
  headers.forEach((h, i) => {
    doc.text(h, x + 4, y + 6, { width: widths[i] - 6, ellipsis: true });
    x += widths[i];
  });
  doc.fillColor(DARK).font('Helvetica').fontSize(8);
  doc.y = y + 20;
}

function tableRow(doc, cells, widths, x0, bg) {
  const y = doc.y;
  const totalW = widths.reduce((a, b) => a + b, 0);
  drawRect(doc, x0, y, totalW, 17, bg || 'white', BORDER);
  doc.fillColor(DARK).fontSize(7.5).font('Helvetica');
  let x = x0;
  cells.forEach((cell, i) => {
    doc.text(String(cell ?? '—'), x + 4, y + 5, { width: widths[i] - 6, ellipsis: true });
    x += widths[i];
  });
  doc.y = y + 17;
}

function tableFooter(doc, cells, widths, x0) {
  const y = doc.y;
  const totalW = widths.reduce((a, b) => a + b, 0);
  drawRect(doc, x0, y, totalW, 19, GREY, BORDER);
  doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold');
  let x = x0;
  cells.forEach((cell, i) => {
    doc.text(String(cell ?? ''), x + 4, y + 6, { width: widths[i] - 6 });
    x += widths[i];
  });
  doc.fillColor(DARK).font('Helvetica');
  doc.y = y + 19;
}

function fmt(n) { return parseFloat(n || 0).toFixed(1); }
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

router.get('/monthly', authenticateToken, requireManager, async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'year and month are required' });

  const y = parseInt(year), m = parseInt(month);
  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 1);
  const monthLabel = startDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  try {
    const result = await db.query(
      `SELECT t.*, u.name AS employee_name, u.employee_code
       FROM trips t
       JOIN users u ON t.employee_id = u.id
       WHERE t.start_time >= $1 AND t.start_time < $2 AND t.status != 'active'
       ORDER BY u.name, t.start_time`,
      [startDate, endDate]
    );

    const trips = result.rows;
    const byEmployee = {};
    for (const t of trips) {
      if (!byEmployee[t.employee_id]) {
        byEmployee[t.employee_id] = { name: t.employee_name, code: t.employee_code || '—', trips: [] };
      }
      byEmployee[t.employee_id].trips.push(t);
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="EVM-Report-${year}-${String(month).padStart(2, '0')}.pdf"`);
    doc.pipe(res);

    // ── Header ──────────────────────────────────────────────
    drawRect(doc, 0, 0, doc.page.width, 80, BLUE);
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
      .text('Employee Vehicle Manager', 40, 18);
    doc.fontSize(11).font('Helvetica')
      .text('Monthly Trip Report', 40, 44);
    doc.fontSize(13).font('Helvetica-Bold')
      .text(monthLabel, doc.page.width - 200, 26, { width: 160, align: 'right' });
    doc.fillColor(DARK);
    doc.y = 100;

    // ── Summary boxes ────────────────────────────────────────
    const allKm = trips.reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0);
    const activeEmps = Object.keys(byEmployee).length;
    const avgKm = trips.length > 0 ? (allKm / trips.length) : 0;

    const boxes = [
      { label: 'Total Trips', value: String(trips.length) },
      { label: 'Total KM', value: `${allKm.toFixed(1)} km` },
      { label: 'Active Employees', value: String(activeEmps) },
      { label: 'Avg KM / Trip', value: `${avgKm.toFixed(1)} km` },
    ];
    const bw = (doc.page.width - 80) / boxes.length;
    const by = doc.y;
    boxes.forEach((b, i) => {
      drawRect(doc, 40 + i * bw, by, bw - 4, 44, LIGHT_BLUE, BORDER);
      doc.fillColor(BLUE).fontSize(14).font('Helvetica-Bold')
        .text(b.value, 40 + i * bw + 4, by + 8, { width: bw - 12, align: 'center' });
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica')
        .text(b.label, 40 + i * bw + 4, by + 28, { width: bw - 12, align: 'center' });
    });
    doc.fillColor(DARK);
    doc.y = by + 56;

    // ── Employee summary table ───────────────────────────────
    doc.fontSize(11).font('Helvetica-Bold').text('Summary by Employee', 40);
    doc.moveDown(0.3);

    const sumW = [200, 100, 80, 135];
    tableHeader(doc, ['Employee', 'Code', 'Trips', 'Total KM'], sumW, 40);

    let totTrips = 0, totKm = 0;
    for (const emp of Object.values(byEmployee)) {
      const eKm = emp.trips.reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0);
      totTrips += emp.trips.length;
      totKm += eKm;
      tableRow(doc, [emp.name, emp.code, emp.trips.length, `${eKm.toFixed(1)} km`], sumW, 40);
    }
    tableFooter(doc, ['TOTAL', '', totTrips, `${totKm.toFixed(1)} km`], sumW, 40);
    doc.moveDown(1.5);

    // ── Per-employee detail ──────────────────────────────────
    for (const emp of Object.values(byEmployee)) {
      if (doc.y > 650) doc.addPage();

      drawRect(doc, 40, doc.y, doc.page.width - 80, 22, BLUE);
      doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
        .text(`${emp.name}  (${emp.code})`, 44, doc.y - 16);
      doc.fillColor(DARK);
      doc.y += 4;

      const tw = [60, 235, 110, 110];
      tableHeader(doc, ['Date', 'Purpose', 'Odometer KM', 'GPS KM'], tw, 40);

      for (const t of emp.trips) {
        if (doc.y > 700) doc.addPage();
        tableRow(doc, [
          fmtDate(t.start_time),
          (t.purpose || 'Trip').substring(0, 45),
          t.manual_distance_km != null ? `${fmt(t.manual_distance_km)} km` : '—',
          t.gps_distance_km != null ? `${fmt(t.gps_distance_km)} km` : '—',
        ], tw, 40);
      }
      doc.moveDown(1.2);
    }

    // ── Footer ───────────────────────────────────────────────
    const footerY = doc.page.height - 35;
    doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica')
      .text(
        `Generated by Employee Vehicle Manager  ·  ${new Date().toLocaleString('en-IN')}`,
        40, footerY, { align: 'center', width: doc.page.width - 80 }
      );

    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

module.exports = router;
