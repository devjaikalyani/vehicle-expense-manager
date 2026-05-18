import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

function getMonthlyData(trips, months = 6) {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const mt = trips.filter(t => {
      const td = new Date(t.start_time);
      return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
    });
    return {
      label: d.toLocaleString('en-IN', { month: 'short' }),
      claimed: Math.round(mt.reduce((s, t) => s + parseFloat(t.expense_amount || 0), 0)),
      approved: Math.round(mt.filter(t => t.status === 'approved').reduce((s, t) => s + parseFloat(t.expense_amount || 0), 0)),
      trips: mt.length,
    };
  });
}

function getEmployeeData(trips) {
  const map = {};
  trips.forEach(t => {
    if (!map[t.employee_name]) map[t.employee_name] = { name: t.employee_name, claimed: 0, approved: 0, trips: 0 };
    map[t.employee_name].claimed += parseFloat(t.expense_amount || 0);
    if (t.status === 'approved') map[t.employee_name].approved += parseFloat(t.expense_amount || 0);
    map[t.employee_name].trips++;
  });
  return Object.values(map)
    .sort((a, b) => b.claimed - a.claimed)
    .slice(0, 8)
    .map(e => ({ ...e, claimed: Math.round(e.claimed), approved: Math.round(e.approved), name: e.name.split(' ')[0] }));
}

function IssueList({ title, description, items, color, onAction }) {
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-solid)' }}>
        <div>
          <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text)' }}>{title}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{description}</div>
        </div>
        <span style={{
          background: items.length > 0 ? `${color}1a` : '#10b98115',
          color: items.length > 0 ? color : '#10b981',
          borderRadius: '20px', padding: '2px 12px', fontSize: '0.8rem', fontWeight: '700', flexShrink: 0,
        }}>
          {items.length} issue{items.length !== 1 ? 's' : ''}
        </span>
      </div>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#10b981', fontSize: '0.85rem', padding: '1rem 0' }}>All clear</div>
      ) : (
        items.map((trip, i) => (
          <div key={trip.id} style={{
            padding: '0.75rem 0',
            borderBottom: i < items.length - 1 ? '1px solid var(--border-solid)' : 'none',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flex: 1, minWidth: 0 }}>
              <Avatar name={trip.employee_name} size={30} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text)' }}>{trip.employee_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {trip.purpose || 'No purpose'} · {fmtDate(trip.start_time)}
                </div>
              </div>
            </div>
            <div style={{ flexShrink: 0, marginLeft: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
              <span className={`badge badge-${trip.status}`}>{trip.status}</span>
              {trip.status === 'pending' && onAction && (
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button className="btn btn-success btn-sm" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => onAction(trip, 'approve')}>Approve</button>
                  <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => onAction(trip, 'reject')}>Reject</button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

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

  const [teams, setTeams] = useState([]);
  const [teamForm, setTeamForm] = useState({ name: '' });
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState(6);
  const [tripSearchInput, setTripSearchInput] = useState('');
  const [tripSearch, setTripSearch] = useState('');

  const applyTripSearch = () => setTripSearch(tripSearchInput.trim());
  const clearTripSearch = () => { setTripSearchInput(''); setTripSearch(''); };

  const fetchAll = useCallback(async () => {
    const [tripsRes, empRes, vehRes] = await Promise.all([
      axios.get('/api/trips'),
      axios.get('/api/employees'),
      axios.get('/api/employees/vehicles'),
    ]);
    setTrips(tripsRes.data.filter(t => t.status !== 'active'));
    setEmployees(empRes.data);
    setVehicles(vehRes.data);
    try {
      const teamsRes = await axios.get('/api/employees/teams');
      setTeams(teamsRes.data);
    } catch { setTeams([]); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = (filter === 'all' ? trips : trips.filter(t => t.status === filter))
    .filter(t => !tripSearch ||
      (t.employee_name || '').toLowerCase().includes(tripSearch.toLowerCase()) ||
      (t.purpose || '').toLowerCase().includes(tripSearch.toLowerCase())
    );
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

  // ── Team management ────────────────────────────────────────────────────────
  const addTeam = async (e) => {
    e.preventDefault(); setFormError('');
    try {
      await axios.post('/api/employees/teams', teamForm);
      await fetchAll();
      setShowTeamForm(false);
      setTeamForm({ name: '' });
    } catch (err) { setFormError(err.response?.data?.error || 'Failed to create team'); }
  };

  const deleteTeam = async (id) => {
    try {
      await axios.delete(`/api/employees/teams/${id}`);
      await fetchAll();
    } catch (err) { alert(err.response?.data?.error || 'Failed to delete team'); }
  };

  const assignTeam = async (empId, teamId) => {
    try {
      await axios.patch(`/api/employees/${empId}/team`, { team_id: teamId || null });
      await fetchAll();
    } catch (err) { alert(err.response?.data?.error || 'Failed to assign team'); }
  };

  // ── Monthly report ──────────────────────────────────────────────────────────
  const downloadReport = async () => {
    setReportLoading(true);
    try {
      const [year, month] = reportMonth.split('-');
      const res = await fetch(`/api/reports/monthly?year=${year}&month=${month}`, {
        credentials: 'include',
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

  const exportEmployeeCSV = () => {
    const empMap = {};
    trips.forEach(t => {
      if (!empMap[t.employee_name]) empMap[t.employee_name] = { name: t.employee_name, code: t.employee_code || '', trips: 0, km: 0, total: 0, approved: 0, pending: 0, rejected: 0 };
      const e = empMap[t.employee_name];
      e.trips++;
      e.km += parseFloat(t.manual_distance_km || t.gps_distance_km || 0);
      e.total += parseFloat(t.expense_amount || 0);
      if (t.status === 'approved') e.approved += parseFloat(t.expense_amount || 0);
      else if (t.status === 'pending') e.pending += parseFloat(t.expense_amount || 0);
      else if (t.status === 'rejected') e.rejected += parseFloat(t.expense_amount || 0);
    });
    const rows = [
      ['Employee', 'Code', 'Trips', 'Total KM', 'Total Claimed', 'Approved', 'Pending', 'Rejected'],
      ...Object.values(empMap).sort((a, b) => b.total - a.total).map(e => [
        e.name, e.code, e.trips, e.km.toFixed(1), e.total.toFixed(2), e.approved.toFixed(2), e.pending.toFixed(2), e.rejected.toFixed(2),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `employee-summary-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
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
          { key: 'analytics', label: 'Analytics' },
          { key: 'employees', label: 'Employees' },
          { key: 'vehicles', label: 'Vehicles' },
          { key: 'field', label: 'Field Status' },
          { key: 'compliance', label: 'Compliance' },
          { key: 'teams', label: 'Teams' },
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

          {/* Search bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.6rem',
            background: '#f8fafc',
            border: '1.5px solid #e2e8f0',
            borderRadius: '10px',
            padding: '0.4rem 0.6rem',
            transition: 'border-color 0.15s',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={tripSearchInput}
              onChange={e => setTripSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyTripSearch()}
              placeholder="Search by employee or purpose..."
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '0.875rem',
                color: '#0f172a',
                padding: '0.2rem 0',
                minWidth: 0,
              }}
            />
            {tripSearchInput && (
              <button
                onClick={clearTripSearch}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '0.1rem 0.25rem',
                  lineHeight: 1,
                  fontSize: '1rem',
                  flexShrink: 0,
                  borderRadius: '4px',
                }}
                title="Clear"
              >
                &times;
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={applyTripSearch}
              style={{ flexShrink: 0, padding: '0.3rem 0.9rem' }}
            >
              Search
            </button>
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

      {/* ────────────────────── ANALYTICS TAB ────────────────────── */}
      {tab === 'analytics' && (() => {
        const monthlyData = getMonthlyData(trips, analyticsRange);
        const employeeData = getEmployeeData(trips);
        const approved = trips.filter(t => t.status === 'approved');
        const rejected = trips.filter(t => t.status === 'rejected');
        const pending = trips.filter(t => t.status === 'pending');
        const approvalRate = (approved.length + rejected.length) > 0
          ? Math.round((approved.length / (approved.length + rejected.length)) * 100) : 0;
        const avgTrip = approved.length > 0
          ? Math.round(approved.reduce((s, t) => s + parseFloat(t.expense_amount || 0), 0) / approved.length) : 0;
        const now = new Date();
        const thisMonthTrips = trips.filter(t => {
          const d = new Date(t.start_time);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;
        const totalPending = pending.reduce((s, t) => s + parseFloat(t.expense_amount || 0), 0);
        const statusData = [
          { name: 'Approved', value: approved.length, color: '#10b981' },
          { name: 'Pending', value: pending.length, color: '#f59e0b' },
          { name: 'Rejected', value: rejected.length, color: '#ef4444' },
        ].filter(d => d.value > 0);

        const tooltipStyle = {
          contentStyle: { background: 'var(--surface)', border: '1px solid var(--border-solid)', borderRadius: '10px', fontSize: '0.8rem' },
          labelStyle: { fontWeight: '600', marginBottom: '2px' },
        };

        return (
          <div>
            {/* KPI row */}
            <div className="stats-grid" style={{ marginBottom: '1rem' }}>
              <div className="stat-card stat-card-emerald">
                <div className="stat-value">{approvalRate}%</div>
                <div className="stat-label">Approval Rate</div>
              </div>
              <div className="stat-card stat-card-ocean">
                <div className="stat-value">{fmtINR(avgTrip)}</div>
                <div className="stat-label">Avg Approved Trip</div>
              </div>
              <div className="stat-card stat-card-indigo">
                <div className="stat-value">{thisMonthTrips}</div>
                <div className="stat-label">Trips This Month</div>
              </div>
              <div className="stat-card stat-card-amber">
                <div className="stat-value">{fmtINR(totalPending)}</div>
                <div className="stat-label">Pending Amount</div>
              </div>
            </div>

            {/* Monthly trend */}
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text)' }}>Monthly Expense Trend</div>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {[3, 6, 12].map(n => (
                    <button key={n} onClick={() => setAnalyticsRange(n)} className={`pill ${analyticsRange === n ? 'pill-active' : 'pill-inactive'}`} style={{ padding: '2px 10px', fontSize: '0.75rem' }}>
                      {n}M
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mgclaimed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#667eea" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#667eea" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="mgapproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
                  <Tooltip {...tooltipStyle} formatter={(v, name) => [`₹${v.toLocaleString('en-IN')}`, name === 'claimed' ? 'Claimed' : 'Approved']} />
                  <Area type="monotone" dataKey="claimed" stroke="#667eea" strokeWidth={2.5} fill="url(#mgclaimed)" dot={false} />
                  <Area type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={2.5} fill="url(#mgapproved)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '1.2rem', marginTop: '0.5rem', justifyContent: 'center' }}>
                {[['#667eea', 'Claimed'], ['#10b981', 'Approved']].map(([color, label]) => (
                  <span key={label} style={{ fontSize: '0.75rem', color, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: 14, height: 2.5, background: color, display: 'inline-block', borderRadius: 2 }} />{label}
                  </span>
                ))}
              </div>
            </div>

            {/* Employee bar + Status pie */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div className="card">
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text)', marginBottom: '1rem' }}>Top Claimants</div>
                {employeeData.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>No trip data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(180, employeeData.length * 32)}>
                    <BarChart data={employeeData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={64} />
                      <Tooltip {...tooltipStyle} formatter={(v, name) => [`₹${v.toLocaleString('en-IN')}`, name === 'claimed' ? 'Claimed' : 'Approved']} />
                      <Bar dataKey="claimed" fill="#667eea" radius={[0, 4, 4, 0]} maxBarSize={16} />
                      <Bar dataKey="approved" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="card">
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text)', marginBottom: '1rem' }}>Claim Status Breakdown</div>
                {statusData.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>No trips yet.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={190}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} dataKey="value" paddingAngle={3}>
                          {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v, name) => [v + ' trips', name]} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-solid)', borderRadius: '10px', fontSize: '0.8rem' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      {statusData.map(d => (
                        <span key={d.name} style={{ fontSize: '0.78rem', color: d.color, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ width: 10, height: 10, background: d.color, borderRadius: '50%', display: 'inline-block' }} />
                          {d.name} ({d.value})
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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

          <div style={{ marginTop: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem' }}>Employee Summary CSV</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              One row per employee — trips, total KM, claimed, approved, pending, rejected.
            </p>
            <button className="btn btn-ghost" onClick={exportEmployeeCSV}>Download Employee Summary</button>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
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

      {/* ────────────────────── FIELD STATUS TAB ────────────────────── */}
      {tab === 'field' && (() => {
        const now = new Date();
        const curMonth = now.getMonth();
        const curYear = now.getFullYear();
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {employees.map(emp => {
              const empTrips = trips.filter(t => t.employee_id === emp.id);
              const lastTrip = empTrips[0];
              const monthTrips = empTrips.filter(t => {
                const d = new Date(t.start_time);
                return d.getMonth() === curMonth && d.getFullYear() === curYear;
              });
              const hasPending = empTrips.some(t => t.status === 'pending');
              const monthTotal = monthTrips.reduce((s, t) => s + parseFloat(t.expense_amount || 0), 0);
              return (
                <div key={emp.id} className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
                    <Avatar name={emp.name} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {emp.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {emp.employee_code || emp.email}
                      </div>
                    </div>
                    {hasPending
                      ? <span className="badge badge-pending" style={{ flexShrink: 0 }}>Pending</span>
                      : empTrips.length > 0
                        ? <span className="badge badge-approved" style={{ flexShrink: 0 }}>Active</span>
                        : null}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div style={{ background: 'var(--surface-2)', borderRadius: '8px', padding: '0.5rem 0.65rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>This Month</div>
                      <div style={{ fontWeight: '700', color: 'var(--text)', fontSize: '0.9rem' }}>{monthTrips.length} trips</div>
                    </div>
                    <div style={{ background: 'var(--surface-2)', borderRadius: '8px', padding: '0.5rem 0.65rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Monthly Exp</div>
                      <div style={{ fontWeight: '700', color: 'var(--text)', fontSize: '0.9rem' }}>{fmtINR(monthTotal)}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '0.65rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {lastTrip
                      ? `Last trip: ${fmtDate(lastTrip.start_time)} — ${lastTrip.purpose || 'Trip'}`
                      : 'No trips recorded'}
                  </div>
                  {emp.phone && (
                    <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.phone}</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ────────────────────── COMPLIANCE TAB ────────────────────── */}
      {tab === 'compliance' && (() => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const missingOdo = trips.filter(t => t.status !== 'active' && t.start_odometer == null && t.end_odometer == null);
        const longPending = trips.filter(t => t.status === 'pending' && new Date(t.start_time) < sevenDaysAgo);
        const missingPurpose = trips.filter(t => !t.purpose || t.purpose.trim() === '');
        const total = missingOdo.length + longPending.length + missingPurpose.length;
        return (
          <div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              {[
                { label: 'Pending Over 7 Days', count: longPending.length, color: '#ef4444' },
                { label: 'Missing Odometer', count: missingOdo.length, color: '#f59e0b' },
                { label: 'Missing Purpose', count: missingPurpose.length, color: '#8b5cf6' },
              ].map(({ label, count, color }) => (
                <div key={label} style={{
                  flex: '1 1 160px',
                  background: count > 0 ? `${color}12` : '#10b98112',
                  border: `1px solid ${count > 0 ? color + '40' : '#10b98140'}`,
                  borderRadius: 'var(--radius)',
                  padding: '0.85rem 1rem',
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', color: count > 0 ? color : '#10b981', lineHeight: 1 }}>{count}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontWeight: '600' }}>{label}</div>
                </div>
              ))}
            </div>
            {total === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#10b981', fontWeight: '600', fontSize: '0.95rem' }}>
                No compliance issues found.
              </div>
            )}
            <IssueList
              title="Pending Over 7 Days"
              description="Trips awaiting approval for more than 7 days"
              items={longPending}
              color="#ef4444"
              onAction={(trip, action) => setModal({ trip, action })}
            />
            <IssueList
              title="Missing Odometer Reading"
              description="Completed trips where neither start nor end odometer was recorded"
              items={missingOdo}
              color="#f59e0b"
              onAction={(trip, action) => setModal({ trip, action })}
            />
            <IssueList
              title="Missing Trip Purpose"
              description="Trips submitted without a purpose description"
              items={missingPurpose}
              color="#8b5cf6"
              onAction={(trip, action) => setModal({ trip, action })}
            />
          </div>
        );
      })()}

      {/* ────────────────────── TEAMS TAB ────────────────────── */}
      {tab === 'teams' && (
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: '700' }}>Teams ({teams.length})</h2>
              <button className="btn btn-primary btn-sm" onClick={() => { setShowTeamForm(!showTeamForm); setFormError(''); }}>
                {showTeamForm ? 'Cancel' : '+ New Team'}
              </button>
            </div>
            {showTeamForm && (
              <form onSubmit={addTeam} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {formError && <div className="alert alert-error" style={{ width: '100%' }}>{formError}</div>}
                <input
                  value={teamForm.name}
                  onChange={e => setTeamForm({ name: e.target.value })}
                  placeholder="Team name (e.g. North Region)"
                  required
                  style={{ flex: 1, minWidth: '180px' }}
                />
                <button type="submit" className="btn btn-success btn-sm">Create</button>
              </form>
            )}
            {teams.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
                No teams yet. Run the teams migration then create a team to group employees.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.65rem' }}>
                {teams.map(team => (
                  <div key={team.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-solid)', borderRadius: 'var(--radius)', padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text)' }}>{team.name}</div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => deleteTeam(team.id)}
                        style={{ padding: '2px 8px', fontSize: '0.72rem', color: '#ef4444' }}
                      >
                        Delete
                      </button>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      {(team.members || []).length} member{(team.members || []).length !== 1 ? 's' : ''}
                    </div>
                    {(team.members || []).map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                        <Avatar name={m.name} size={22} />
                        <span style={{ fontSize: '0.78rem', color: 'var(--text)' }}>{m.name.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>Assign Employees to Teams</h2>
            {teams.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Create a team above before assigning employees.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.65rem' }}>
                {employees.filter(e => e.role === 'employee').map(emp => {
                  const currentTeamId = teams.find(t => (t.members || []).some(m => m.id === emp.id))?.id || '';
                  return (
                    <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border-solid)', borderRadius: 'var(--radius)', padding: '0.65rem 0.85rem' }}>
                      <Avatar name={emp.name} size={32} />
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600', fontSize: '0.85rem', color: 'var(--text)' }}>
                        {emp.name}
                      </div>
                      <select
                        value={String(currentTeamId)}
                        onChange={e => assignTeam(emp.id, e.target.value)}
                        style={{ fontSize: '0.78rem', padding: '0.25rem 0.4rem', borderRadius: '6px', border: '1px solid var(--border-solid)', background: 'var(--surface)', color: 'var(--text)', minWidth: '100px', flexShrink: 0 }}
                      >
                        <option value="">No team</option>
                        {teams.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {modal && <ActionModal trip={modal.trip} action={modal.action} onConfirm={handleAction} onCancel={() => setModal(null)} />}
      {bulkModal && <BulkModal count={selected.size} action={bulkModal.action} onConfirm={handleBulkAction} onCancel={() => setBulkModal(null)} />}
    </div>
  );
}
