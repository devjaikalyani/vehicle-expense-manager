const express = require('express');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { authenticateToken, requireManager } = require('../middleware/auth');

const router = express.Router();

const BLUE = '#1e40af';
const DARK = '#0f172a';
const LIGHT_BLUE = '#dbeafe';
const GREEN_BG = '#f0fdf4';
const RED_BG = '#fff1f2';
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
function inr(n) { return 'Rs.' + parseFloat(n || 0).toFixed(0); }
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
      `SELECT t.*, u.name AS employee_name, u.employee_code,
              v.name AS vehicle_name, v.type AS vehicle_type, v.registration_number
       FROM trips t
       JOIN users u ON t.employee_id = u.id
       LEFT JOIN vehicles v ON t.vehicle_id = v.id
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
    res.setHeader('Content-Disposition', `attachment; filename="VEM-Report-${year}-${String(month).padStart(2, '0')}.pdf"`);
    doc.pipe(res);

    // ── Header ──────────────────────────────────────────────
    drawRect(doc, 0, 0, doc.page.width, 80, BLUE);
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
      .text('Vehicle Expense Manager', 40, 18);
    doc.fontSize(11).font('Helvetica')
      .text('Monthly Expense Report', 40, 44);
    doc.fontSize(13).font('Helvetica-Bold')
      .text(monthLabel, doc.page.width - 200, 26, { width: 160, align: 'right' });
    doc.fillColor(DARK);
    doc.y = 100;

    // ── Summary box ──────────────────────────────────────────
    const allKm = trips.reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0);
    const allClaimed = trips.reduce((s, t) => s + parseFloat(t.expense_amount || 0), 0);
    const allApproved = trips.filter(t => t.status === 'approved').reduce((s, t) => s + parseFloat(t.expense_amount || 0), 0);
    const allPending = trips.filter(t => t.status === 'pending').length;

    const boxes = [
      { label: 'Total Trips', value: String(trips.length) },
      { label: 'Total KM', value: `${allKm.toFixed(1)} km` },
      { label: 'Amount Claimed', value: `Rs.${allClaimed.toFixed(0)}` },
      { label: 'Amount Approved', value: `Rs.${allApproved.toFixed(0)}` },
      { label: 'Pending Review', value: String(allPending) },
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

    // ── Employee summary table ──────────────────────────────
    doc.fontSize(11).font('Helvetica-Bold').text('Summary by Employee', 40);
    doc.moveDown(0.3);

    const sumW = [140, 65, 40, 60, 70, 80, 60];
    tableHeader(doc, ['Employee', 'Code', 'Trips', 'Total KM', 'Fuel Exp.', 'Total Claimed', 'Approved'], sumW, 40);

    let totTrips = 0, totKm = 0, totFuel = 0, totClaimed = 0, totAppr = 0;
    for (const emp of Object.values(byEmployee)) {
      const eKm = emp.trips.reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0);
      const eFuel = emp.trips.reduce((s, t) => s + parseFloat(t.fuel_expense_amount || 0), 0);
      const eClaimed = emp.trips.reduce((s, t) => s + parseFloat(t.expense_amount || 0), 0);
      const eApproved = emp.trips.filter(t => t.status === 'approved').reduce((s, t) => s + parseFloat(t.expense_amount || 0), 0);
      totTrips += emp.trips.length; totKm += eKm; totFuel += eFuel; totClaimed += eClaimed; totAppr += eApproved;
      tableRow(doc, [emp.name, emp.code, emp.trips.length, `${eKm.toFixed(1)} km`, inr(eFuel), inr(eClaimed), inr(eApproved)], sumW, 40);
    }
    tableFooter(doc, ['TOTAL', '', totTrips, `${totKm.toFixed(1)} km`, inr(totFuel), inr(totClaimed), inr(totAppr)], sumW, 40);
    doc.moveDown(1.5);

    // ── Per-employee detail ──────────────────────────────────
    for (const emp of Object.values(byEmployee)) {
      if (doc.y > 650) doc.addPage();

      drawRect(doc, 40, doc.y, doc.page.width - 80, 22, BLUE);
      doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
        .text(`${emp.name}  (${emp.code})`, 44, doc.y - 16);
      doc.fillColor(DARK);
      doc.y += 4;

      const tw = [55, 130, 85, 42, 42, 55, 60, 60];
      tableHeader(doc, ['Date', 'Purpose', 'Vehicle', 'Odm KM', 'GPS KM', 'Fuel', 'Total', 'Status'], tw, 40);

      for (const t of emp.trips) {
        if (doc.y > 700) doc.addPage();
        const bg = t.status === 'approved' ? GREEN_BG : t.status === 'rejected' ? RED_BG : 'white';
        tableRow(doc, [
          fmtDate(t.start_time),
          (t.purpose || 'Trip').substring(0, 32),
          t.vehicle_name ? t.vehicle_name.substring(0, 16) : '—',
          t.manual_distance_km != null ? `${fmt(t.manual_distance_km)} km` : '—',
          t.gps_distance_km != null ? `${fmt(t.gps_distance_km)} km` : '—',
          parseFloat(t.fuel_expense_amount || 0) > 0 ? inr(t.fuel_expense_amount) : '—',
          inr(t.expense_amount),
          t.status,
        ], tw, 40, bg);
      }
      doc.moveDown(1.2);
    }

    // ── Footer ───────────────────────────────────────────────
    const footerY = doc.page.height - 35;
    doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica')
      .text(
        `Generated by Vehicle Expense Manager  ·  ${new Date().toLocaleString('en-IN')}`,
        40, footerY, { align: 'center', width: doc.page.width - 80 }
      );

    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

module.exports = router;
