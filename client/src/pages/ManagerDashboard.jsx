import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function fmt(n) { return parseFloat(n || 0).toFixed(1); }
function fmtINR(n) { return '₹' + parseFloat(n || 0).toFixed(0); }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

function avatarBg(name) {
  const colors = ['#667eea', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f5576c'];
  return colors[(name || '').charCodeAt(0) % colors.length];
}

function Avatar({ name, size = 36 }) {
  const initials = (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: avatarBg(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontSize: size * 0.36, fontWeight: '700', flexShrink: 0,
    }}>{initials}</div>
  );
}

// ── Action confirmation modal ────────────────────────────────────────────────
function ActionModal({ trip, action, onConfirm, onCancel }) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => { setLoading(true); await onConfirm(notes); setLoading(false); };
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', margin: 0 }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'capitalize' }}>{action} Trip</h2>
        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          <div style={{ fontWeight: '600' }}>{trip.employee_name} — {trip.employee_code}</div>
          <div style={{ color: '#475569', marginTop: '0.2rem' }}>{trip.purpose}</div>
          <div style={{ color: '#1e40af', fontWeight: '700', marginTop: '0.3rem' }}>
            {fmt(trip.manual_distance_km || trip.gps_distance_km)} km — {fmtINR(trip.expense_amount)}
          </div>
        </div>
        <div className="form-group">
          <label>Notes for employee (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Reason, correction, etc." />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn ${action === 'approve' ? 'btn-success' : 'btn-danger'}`} onClick={submit} disabled={loading} style={{ flex: 1 }}>
            {loading ? 'Processing...' : action === 'approve' ? 'Approve' : 'Reject'}
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk confirmation modal ──────────────────────────────────────────────────
function BulkModal({ count, action, onConfirm, onCancel }) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => { setLoading(true); await onConfirm(notes); setLoading(false); };
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', margin: 0 }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
          Bulk {action} — {count} trip{count > 1 ? 's' : ''}
        </h2>
        <div className="form-group">
          <label>Notes (applied to all selected trips)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Bulk action reason..." />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn ${action === 'approve' ? 'btn-success' : 'btn-danger'}`} onClick={submit} disabled={loading} style={{ flex: 1 }}>
            {loading ? 'Processing...' : `${action === 'approve' ? 'Approve' : 'Reject'} All ${count}`}
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function ManagerDashboard() {
  const [trips, setTrips] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [tab, setTab] = useState('trips');
  const [modal, setModal] = useState(null);
  const [bulkModal, setBulkModal] = useState(null);
  const [selected, setSelected] = useState(new Set()); // selected trip IDs for bulk action

  const [showEmpForm, setShowEmpForm] = useState(false);
  const [showVehForm, setShowVehForm] = useState(false);
  const [empForm, setEmpForm] = useState({ name: '', email: '', password: '', role: 'employee', employee_code: '', phone: '' });
  const [vehForm, setVehForm] = useState({ name: '', registration_number: '', type: 'two_wheeler', assigned_to: '' });
  const [formError, setFormError] = useState('');

  // Report download state
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reportLoading, setReportLoading] = useState(false);

  // Custom rate editing: employeeId -> rate string
  const [editingRate, setEditingRate] = useState({});

  const fetchAll = useCallback(async () => {
    const [tripsRes, empRes, vehRes] = await Promise.all([
      axios.get('/api/trips'),
      axios.get('/api/employees'),
      axios.get('/api/employees/vehicles'),
    ]);
    setTrips(tripsRes.data.filter(t => t.status !== 'active'));
    setEmployees(empRes.data);
    setVehicles(vehRes.data);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = filter === 'all' ? trips : trips.filter(t => t.status === filter);
  const pendingTrips = trips.filter(t => t.status === 'pending');
  const pendingCount = pendingTrips.length;

  // ── Bulk selection helpers ──────────────────────────────────────────────────
  const pendingFiltered = filtered.filter(t => t.status === 'pending');
  const allPendingSelected = pendingFiltered.length > 0 && pendingFiltered.every(t => selected.has(t.id));

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelected(prev => { const next = new Set(prev); pendingFiltered.forEach(t => next.delete(t.id)); return next; });
    } else {
      setSelected(prev => { const next = new Set(prev); pendingFiltered.forEach(t => next.add(t.id)); return next; });
    }
  };

  // ── Single action ───────────────────────────────────────────────────────────
  const handleAction = async (notes) => {
    await axios.patch(`/api/trips/${modal.trip.id}/${modal.action}`, { manager_notes: notes });
    setSelected(prev => { const next = new Set(prev); next.delete(modal.trip.id); return next; });
    await fetchAll();
    setModal(null);
  };

  // ── Bulk action ─────────────────────────────────────────────────────────────
  const handleBulkAction = async (notes) => {
    const ids = [...selected].filter(id => trips.find(t => t.id === id && t.status === 'pending'));
    await axios.patch('/api/trips/bulk-action', { tripIds: ids, action: bulkModal.action, manager_notes: notes });
    setSelected(new Set());
    await fetchAll();
    setBulkModal(null);
  };

  // ── Add employee ────────────────────────────────────────────────────────────
  const addEmployee = async (e) => {
    e.preventDefault(); setFormError('');
    try {
      await axios.post('/api/employees', empForm);
      await fetchAll();
      setShowEmpForm(false);
      setEmpForm({ name: '', email: '', password: '', role: 'employee', employee_code: '', phone: '' });
    } catch (err) { setFormError(err.response?.data?.error || 'Failed to add employee'); }
  };

  // ── Add vehicle ─────────────────────────────────────────────────────────────
  const addVehicle = async (e) => {
    e.preventDefault(); setFormError('');
    try {
      await axios.post('/api/employees/vehicles', vehForm);
      await fetchAll();
      setShowVehForm(false);
      setVehForm({ name: '', registration_number: '', type: 'two_wheeler', assigned_to: '' });
    } catch (err) { setFormError(err.response?.data?.error || 'Failed to add vehicle'); }
  };

  // ── Custom rate ─────────────────────────────────────────────────────────────
  const saveRate = async (empId) => {
    try {
      await axios.patch(`/api/employees/${empId}/rate`, { custom_rate_inr_per_km: editingRate[empId] || null });
      setEditingRate(prev => { const n = { ...prev }; delete n[empId]; return n; });
      await fetchAll();
    } catch (err) { alert(err.response?.data?.error || 'Failed to update rate'); }
  };

  // ── Monthly report ──────────────────────────────────────────────────────────
  const downloadReport = async () => {
    setReportLoading(true);
    try {
      const [year, month] = reportMonth.split('-');
      const token = localStorage.getItem('vem_token');
      const res = await fetch(`/api/reports/monthly?year=${year}&month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Report generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `VEM-Report-${reportMonth}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert(err.message); }
    finally { setReportLoading(false); }
  };

  // ── CSV export ──────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Date', 'Employee', 'Code', 'Purpose', 'Vehicle', 'Odo KM', 'GPS KM', 'Fuel', 'Total', 'Status'],
      ...filtered.map(t => [
        fmtDate(t.start_time), t.employee_name, t.employee_code || '', t.purpose || '',
        t.vehicle_name ? `${t.vehicle_name} (${t.registration_number})` : '',
        fmt(t.manual_distance_km), fmt(t.gps_distance_km),
        parseFloat(t.fuel_expense_amount || 0).toFixed(2),
        parseFloat(t.expense_amount || 0).toFixed(2), t.status,
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `manager-trips-${filter}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const approvedTotal = trips.filter(t => t.status === 'approved').reduce((s, t) => s + parseFloat(t.expense_amount || 0), 0);
  const totalKmApproved = trips.filter(t => t.status === 'approved').reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0);

  return (
    <div>
      <div className="gradient-header">
        <h1>Manager Dashboard</h1>
        <p>Review claims, manage employees, vehicles, and reports</p>
      </div>

      {/* Summary stats */}
      <div className="stats-grid">
        <div className={`stat-card ${pendingCount > 0 ? 'stat-card-amber' : 'stat-card-indigo'}`}>
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-label">Pending Review</div>
        </div>
        <div className="stat-card stat-card-emerald">
          <div className="stat-value">{fmtINR(approvedTotal)}</div>
          <div className="stat-label">Approved Total</div>
        </div>
        <div className="stat-card stat-card-ocean">
          <div className="stat-value">{fmt(totalKmApproved)}</div>
          <div className="stat-label">Approved KM</div>
        </div>
        <div className="stat-card stat-card-indigo">
          <div className="stat-value">{employees.length}</div>
          <div className="stat-label">Employees</div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="tabs">
        {[
          { key: 'trips', label: 'Trips' },
          { key: 'employees', label: 'Employees' },
          { key: 'vehicles', label: 'Vehicles' },
          { key: 'reports', label: 'Reports' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} className={`tab-btn ${tab === key ? 'tab-active' : ''}`}>
            {label}
            {key === 'trips' && pendingCount > 0 && <span className="tab-badge">{pendingCount}</span>}
          </button>
        ))}
      </div>

      {/* ────────────────────── TRIPS TAB ────────────────────── */}
      {tab === 'trips' && (
        <div className="card">
          {/* Filters + actions row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div className="filter-pills" style={{ marginBottom: 0 }}>
              {['pending', 'approved', 'rejected', 'all'].map(f => (
                <button key={f} onClick={() => { setFilter(f); setSelected(new Set()); }} className={`pill ${filter === f ? 'pill-active' : 'pill-inactive'}`}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}{f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {selected.size > 0 && (
                <>
                  <button className="btn btn-success btn-sm" onClick={() => setBulkModal({ action: 'approve' })}>
                    Approve {selected.size}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setBulkModal({ action: 'reject' })}>
                    Reject {selected.size}
                  </button>
                </>
              )}
              <button className="btn btn-ghost btn-sm" onClick={exportCSV}>Export CSV</button>
            </div>
          </div>

          {/* Select-all row (only when viewing pending) */}
          {pendingFiltered.length > 0 && (
            <div style={{ padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.82rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={allPendingSelected}
                onChange={toggleSelectAll}
                style={{ width: 'auto', cursor: 'pointer' }}
              />
              {allPendingSelected ? 'Deselect all pending' : `Select all ${pendingFiltered.length} pending`}
            </div>
          )}

          {filtered.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>No trips in this category.</p>
          ) : (
            filtered.map((trip, i) => (
              <div key={trip.id}>
                {i > 0 && <hr className="trip-divider" />}
                <div className={`trip-item trip-item-${trip.status}`}>
                  <div className="trip-row" style={{ alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                      {trip.status === 'pending' ? (
                        <input
                          type="checkbox"
                          checked={selected.has(trip.id)}
                          onChange={() => toggleSelect(trip.id)}
                          style={{ width: 'auto', cursor: 'pointer', marginTop: '3px', accentColor: 'var(--brand-1)' }}
                        />
                      ) : <div style={{ width: 16, flexShrink: 0 }} />}
                      <Avatar name={trip.employee_name} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '700', color: 'var(--text)', fontSize: '0.95rem' }}>
                          {trip.employee_name}
                          {trip.employee_code && <span style={{ fontWeight: '500', color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.4rem' }}>· {trip.employee_code}</span>}
                        </div>
                        <div style={{ color: 'var(--text-2)', fontSize: '0.875rem', margin: '0.15rem 0' }}>{trip.purpose || 'Trip'}</div>
                        <div className="trip-meta">
                          <span>{fmtDate(trip.start_time)}</span>
                          {trip.vehicle_name && <span>{trip.vehicle_name}</span>}
                          {trip.manual_distance_km != null && <span>Odo: {fmt(trip.manual_distance_km)} km</span>}
                          {trip.gps_distance_km != null && <span>GPS: {fmt(trip.gps_distance_km)} km</span>}
                          {parseFloat(trip.fuel_expense_amount || 0) > 0 && <span>Fuel: {fmtINR(trip.fuel_expense_amount)}</span>}
                          <span style={{ fontWeight: '700', color: 'var(--brand-1)' }}>{fmtINR(trip.expense_amount)}</span>
                        </div>
                        {trip.manager_notes && (
                          <div style={{ marginTop: '0.3rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Note: {trip.manager_notes}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 }}>
                      <span className={`badge badge-${trip.status}`}>{trip.status}</span>
                      {trip.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button className="btn btn-success btn-sm" onClick={() => setModal({ trip, action: 'approve' })}>Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setModal({ trip, action: 'reject' })}>Reject</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ────────────────────── EMPLOYEES TAB ────────────────────── */}
      {tab === 'employees' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '700' }}>Employees ({employees.length})</h2>
            <button className="btn btn-primary btn-sm" onClick={() => { setShowEmpForm(!showEmpForm); setFormError(''); }}>
              {showEmpForm ? 'Cancel' : '+ Add Employee'}
            </button>
          </div>

          {showEmpForm && (
            <form onSubmit={addEmployee} style={{ background: '#f8fafc', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
              {formError && <div className="alert alert-error">{formError}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 1rem' }}>
                <div className="form-group"><label>Full Name *</label><input value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} required /></div>
                <div className="form-group"><label>Email *</label><input type="email" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} required /></div>
                <div className="form-group"><label>Password *</label><input type="password" value={empForm.password} onChange={e => setEmpForm({ ...empForm, password: e.target.value })} required minLength={6} /></div>
                <div className="form-group"><label>Employee Code</label><input value={empForm.employee_code} onChange={e => setEmpForm({ ...empForm, employee_code: e.target.value })} placeholder="RWSIPL-001" /></div>
                <div className="form-group"><label>Phone</label><input value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} /></div>
                <div className="form-group">
                  <label>Role</label>
                  <select value={empForm.role} onChange={e => setEmpForm({ ...empForm, role: e.target.value })}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-success">Create Employee</button>
            </form>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {employees.map(emp => (
              <div key={emp.id} style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.9rem' }}>
                <div style={{ fontWeight: '700', color: '#0f172a' }}>{emp.name}</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{emp.email}</div>
                {emp.employee_code && <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{emp.employee_code}</div>}
                {emp.phone && <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{emp.phone}</div>}
                <span className={`badge ${emp.role === 'employee' ? 'badge-active' : 'badge-manager'}`} style={{ marginTop: '0.4rem' }}>{emp.role}</span>

                {/* Custom per-km rate */}
                <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '600', color: '#475569', marginBottom: '0.35rem' }}>
                    Per-km Rate
                    {emp.custom_rate_inr_per_km != null
                      ? <span style={{ color: '#1e40af' }}> — Custom: Rs.{parseFloat(emp.custom_rate_inr_per_km).toFixed(1)}/km</span>
                      : <span style={{ color: '#94a3b8' }}> — Using vehicle-type default</span>}
                  </div>
                  {editingRate[emp.id] !== undefined ? (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <input
                        type="number"
                        value={editingRate[emp.id]}
                        onChange={e => setEditingRate(prev => ({ ...prev, [emp.id]: e.target.value }))}
                        placeholder="Rs/km"
                        min="0"
                        step="0.5"
                        style={{ width: '100px', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem' }}
                      />
                      <button className="btn btn-success btn-sm" onClick={() => saveRate(emp.id)}>Save</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => {
                        setEditingRate(prev => { const n = { ...prev }; delete n[emp.id]; return n; });
                      }}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditingRate(prev => ({ ...prev, [emp.id]: emp.custom_rate_inr_per_km ?? '' }))}
                      >
                        {emp.custom_rate_inr_per_km != null ? 'Edit Rate' : 'Set Custom Rate'}
                      </button>
                      {emp.custom_rate_inr_per_km != null && (
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          setEditingRate(prev => ({ ...prev, [emp.id]: '' }));
                          axios.patch(`/api/employees/${emp.id}/rate`, { custom_rate_inr_per_km: null }).then(fetchAll);
                        }}>
                          Reset to Default
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────────── VEHICLES TAB ────────────────────── */}
      {tab === 'vehicles' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '700' }}>Vehicles ({vehicles.length})</h2>
            <button className="btn btn-primary btn-sm" onClick={() => { setShowVehForm(!showVehForm); setFormError(''); }}>
              {showVehForm ? 'Cancel' : '+ Add Vehicle'}
            </button>
          </div>

          <div className="alert alert-info" style={{ marginBottom: '1rem', fontSize: '0.82rem' }}>
            Default reimbursement rates: Two-wheeler Rs.6/km · Four-wheeler Rs.12/km · Other Rs.8/km — override per employee in the Employees tab.
          </div>

          {showVehForm && (
            <form onSubmit={addVehicle} style={{ background: '#f8fafc', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
              {formError && <div className="alert alert-error">{formError}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 1rem' }}>
                <div className="form-group"><label>Vehicle Name *</label><input value={vehForm.name} onChange={e => setVehForm({ ...vehForm, name: e.target.value })} placeholder="Honda Activa" required /></div>
                <div className="form-group"><label>Registration Number *</label><input value={vehForm.registration_number} onChange={e => setVehForm({ ...vehForm, registration_number: e.target.value })} placeholder="MH-12-AB-1234" required /></div>
                <div className="form-group">
                  <label>Type</label>
                  <select value={vehForm.type} onChange={e => setVehForm({ ...vehForm, type: e.target.value })}>
                    <option value="two_wheeler">Two-Wheeler (Rs.6/km default)</option>
                    <option value="four_wheeler">Four-Wheeler (Rs.12/km default)</option>
                    <option value="other">Other (Rs.8/km default)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Assign to Employee</label>
                  <select value={vehForm.assigned_to} onChange={e => setVehForm({ ...vehForm, assigned_to: e.target.value })}>
                    <option value="">Unassigned (pool vehicle)</option>
                    {employees.filter(e => e.role === 'employee').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-success">Add Vehicle</button>
            </form>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {vehicles.map(v => (
              <div key={v.id} style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.9rem' }}>
                <div style={{ fontWeight: '700', color: '#0f172a' }}>{v.name}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>{v.registration_number}</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                  {v.type?.replace('_', '-')} · {v.type === 'two_wheeler' ? 'Rs.6/km' : v.type === 'four_wheeler' ? 'Rs.12/km' : 'Rs.8/km'} default
                </div>
                <div style={{ fontSize: '0.8rem', color: v.assigned_to_name ? '#1e40af' : '#94a3b8', marginTop: '0.3rem' }}>
                  {v.assigned_to_name ? `Assigned: ${v.assigned_to_name}` : 'Pool vehicle'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────────── REPORTS TAB ────────────────────── */}
      {tab === 'reports' && (
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>Monthly Expense Report</h2>

          <div style={{ maxWidth: '360px' }}>
            <div className="form-group">
              <label>Select Month</label>
              <input
                type="month"
                value={reportMonth}
                onChange={e => setReportMonth(e.target.value)}
                max={new Date().toISOString().slice(0, 7)}
              />
            </div>
            <button className="btn btn-primary" onClick={downloadReport} disabled={reportLoading}>
              {reportLoading ? 'Generating PDF...' : 'Download PDF Report'}
            </button>
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '10px', fontSize: '0.85rem', color: '#475569' }}>
            <div style={{ fontWeight: '700', marginBottom: '0.5rem', color: '#0f172a' }}>Report includes:</div>
            <ul style={{ paddingLeft: '1.2rem', lineHeight: '1.8' }}>
              <li>Employee-wise summary (trips, total KM, fuel, claimed, approved)</li>
              <li>Detailed trip-by-trip breakdown per employee</li>
              <li>Colour-coded status (approved / rejected / pending)</li>
              <li>Fuel expenses and odometer vs GPS comparison</li>
            </ul>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem' }}>Quick CSV Export</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['pending', 'approved', 'rejected', 'all'].map(f => (
                <button key={f} className="btn btn-ghost btn-sm" onClick={() => { setFilter(f); setTab('trips'); }}>
                  View {f === 'all' ? 'All Trips' : f.charAt(0).toUpperCase() + f.slice(1)} →
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal && <ActionModal trip={modal.trip} action={modal.action} onConfirm={handleAction} onCancel={() => setModal(null)} />}
      {bulkModal && <BulkModal count={selected.size} action={bulkModal.action} onConfirm={handleBulkAction} onCancel={() => setBulkModal(null)} />}
    </div>
  );
}
