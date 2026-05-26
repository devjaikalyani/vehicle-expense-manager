import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  AreaChart, Area, BarChart, Bar,
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
      trips: mt.length,
      km: Math.round(mt.reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0)),
    };
  });
}

function getEmployeeData(trips) {
  const map = {};
  trips.forEach(t => {
    if (!map[t.employee_name]) map[t.employee_name] = { name: t.employee_name, km: 0, trips: 0 };
    map[t.employee_name].km += parseFloat(t.manual_distance_km || t.gps_distance_km || 0);
    map[t.employee_name].trips++;
  });
  return Object.values(map)
    .sort((a, b) => b.km - a.km)
    .slice(0, 8)
    .map(e => ({ ...e, km: Math.round(e.km), name: e.name.split(' ')[0] }));
}

function IssueList({ title, description, items, color }) {
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
          </div>
        ))
      )}
    </div>
  );
}

function fmt(n) { return parseFloat(n || 0).toFixed(1); }
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


export default function ManagerDashboard() {
  const [trips, setTrips] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tab, setTab] = useState('trips');

  const [showEmpForm, setShowEmpForm] = useState(false);
  const [empForm, setEmpForm] = useState({ name: '', email: '', password: '', role: 'employee', employee_code: '', phone: '' });
  const [formError, setFormError] = useState('');

  // Report download state
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reportLoading, setReportLoading] = useState(false);

  const [teams, setTeams] = useState([]);
  const [teamForm, setTeamForm] = useState({ name: '' });
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState(6);
  const [tripSearchInput, setTripSearchInput] = useState('');
  const [tripSearch, setTripSearch] = useState('');
  const [expandedTrip, setExpandedTrip] = useState(null);
  const [tripReceiptsCache, setTripReceiptsCache] = useState({});

  const applyTripSearch = () => setTripSearch(tripSearchInput.trim());
  const clearTripSearch = () => { setTripSearchInput(''); setTripSearch(''); };

  const fetchReceipts = async (tripId) => {
    if (tripReceiptsCache[tripId] !== undefined) return;
    setTripReceiptsCache(prev => ({ ...prev, [tripId]: null }));
    try {
      const res = await axios.get(`/api/receipts/${tripId}`);
      setTripReceiptsCache(prev => ({ ...prev, [tripId]: res.data }));
    } catch {
      setTripReceiptsCache(prev => ({ ...prev, [tripId]: [] }));
    }
  };

  const toggleTrip = (tripId) => {
    if (expandedTrip === tripId) {
      setExpandedTrip(null);
    } else {
      setExpandedTrip(tripId);
      fetchReceipts(tripId);
    }
  };

  const fetchAll = useCallback(async () => {
    const [tripsRes, empRes] = await Promise.all([
      axios.get('/api/trips'),
      axios.get('/api/employees'),
    ]);
    setTrips(tripsRes.data.filter(t => t.status !== 'active'));
    setEmployees(empRes.data);
    try {
      const teamsRes = await axios.get('/api/employees/teams');
      setTeams(teamsRes.data);
    } catch { setTeams([]); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = trips.filter(t => !tripSearch ||
    (t.employee_name || '').toLowerCase().includes(tripSearch.toLowerCase()) ||
    (t.purpose || '').toLowerCase().includes(tripSearch.toLowerCase())
  );


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
      a.href = url; a.download = `EVM-Report-${reportMonth}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert(err.message); }
    finally { setReportLoading(false); }
  };

  // ── XLSX export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Date', 'Employee', 'Code', 'Purpose', 'Vehicle', 'Odo KM', 'GPS KM', 'Status'],
      ...filtered.map(t => [
        fmtDate(t.start_time), t.employee_name, t.employee_code || '', t.purpose || '',
        t.vehicle_name ? `${t.vehicle_name} (${t.registration_number})` : '',
        parseFloat(fmt(t.manual_distance_km)), parseFloat(fmt(t.gps_distance_km)), t.status,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trips');
    XLSX.writeFile(wb, `manager-trips-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportEmployeeCSV = () => {
    const empMap = {};
    trips.forEach(t => {
      if (!empMap[t.employee_name]) empMap[t.employee_name] = { name: t.employee_name, code: t.employee_code || '', trips: 0, km: 0 };
      const e = empMap[t.employee_name];
      e.trips++;
      e.km += parseFloat(t.manual_distance_km || t.gps_distance_km || 0);
    });
    const rows = [
      ['Employee', 'Code', 'Trips', 'Total KM'],
      ...Object.values(empMap).sort((a, b) => b.km - a.km).map(e => [
        e.name, e.code, e.trips, parseFloat(e.km.toFixed(1)),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employee Summary');
    XLSX.writeFile(wb, `employee-summary-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <div className="gradient-header">
        <h1>Manager Dashboard</h1>
        <p>View employee trips, manage employees, vehicles, and reports</p>
      </div>

      {/* Summary stats */}
      <div className="stats-grid">
        <div className="stat-card stat-card-indigo">
          <div className="stat-value">{trips.length}</div>
          <div className="stat-label">Total Trips</div>
        </div>
        <div className="stat-card stat-card-ocean">
          <div className="stat-value">{fmt(trips.reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0))}</div>
          <div className="stat-label">Total KM</div>
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
          { key: 'field', label: 'Field Status' },
          { key: 'compliance', label: 'Compliance' },
          { key: 'teams', label: 'Teams' },
          { key: 'reports', label: 'Reports' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} className={`tab-btn ${tab === key ? 'tab-active' : ''}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ────────────────────── TRIPS TAB ────────────────────── */}
      {tab === 'trips' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.85rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={exportCSV}>Export Excel File</button>
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


          {filtered.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>No trips in this category.</p>
          ) : (
            filtered.map((trip, i) => (
              <div key={trip.id}>
                {i > 0 && <hr className="trip-divider" />}
                <div className={`trip-item trip-item-${trip.status}`}>
                  <div className="trip-row" style={{ alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
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
                        </div>
                        {trip.manager_notes && (
                          <div style={{ marginTop: '0.3rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Note: {trip.manager_notes}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleTrip(trip.id)}
                        style={{ fontSize: '0.75rem' }}
                      >
                        {expandedTrip === trip.id ? 'Hide' : 'Details'}
                      </button>
                    </div>
                  </div>
                </div>
                {expandedTrip === trip.id && (
                  <div style={{
                    background: '#f8fafc', borderTop: '1px solid #e2e8f0',
                    padding: '0.85rem 1rem 1rem', borderRadius: '0 0 10px 10px',
                  }}>
                    {(trip.start_address || trip.end_address) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                        {trip.start_address && (
                          <div>
                            <div style={{ fontSize: '0.68rem', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Start Location</div>
                            <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.4 }}>{trip.start_address}</div>
                          </div>
                        )}
                        {trip.end_address && (
                          <div>
                            <div style={{ fontSize: '0.68rem', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>End Location</div>
                            <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.4 }}>{trip.end_address}</div>
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: '0.68rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Receipts</div>
                    {tripReceiptsCache[trip.id] === null ? (
                      <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Loading...</div>
                    ) : tripReceiptsCache[trip.id] === undefined || tripReceiptsCache[trip.id].length === 0 ? (
                      <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No receipts uploaded</div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {tripReceiptsCache[trip.id].map(r => (
                          <a key={r.id} href={`/uploads/${r.filename}`} target="_blank" rel="noreferrer">
                            <img
                              src={`/uploads/${r.filename}`}
                              alt={r.original_name}
                              style={{
                                width: 88, height: 88, objectFit: 'cover',
                                borderRadius: '8px', border: '1px solid #e2e8f0',
                                cursor: 'pointer', transition: 'opacity 0.15s',
                              }}
                              onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
                              onMouseOut={e => e.currentTarget.style.opacity = '1'}
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ────────────────────── ANALYTICS TAB ────────────────────── */}
      {tab === 'analytics' && (() => {
        const monthlyData = getMonthlyData(trips, analyticsRange);
        const employeeData = getEmployeeData(trips);
        const now = new Date();
        const thisMonthTrips = trips.filter(t => {
          const d = new Date(t.start_time);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const thisMonthKm = Math.round(thisMonthTrips.reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0));
        const totalKmAll = Math.round(trips.reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0));
        const activeEmps = new Set(trips.map(t => t.employee_id)).size;

        const tooltipStyle = {
          contentStyle: { background: 'var(--surface)', border: '1px solid var(--border-solid)', borderRadius: '10px', fontSize: '0.8rem' },
          labelStyle: { fontWeight: '600', marginBottom: '2px' },
        };

        return (
          <div>
            {/* KPI row */}
            <div className="stats-grid" style={{ marginBottom: '1rem' }}>
              <div className="stat-card stat-card-indigo">
                <div className="stat-value">{thisMonthTrips.length}</div>
                <div className="stat-label">Trips This Month</div>
              </div>
              <div className="stat-card stat-card-ocean">
                <div className="stat-value">{thisMonthKm}</div>
                <div className="stat-label">KM This Month</div>
              </div>
              <div className="stat-card stat-card-emerald">
                <div className="stat-value">{totalKmAll}</div>
                <div className="stat-label">Total KM</div>
              </div>
              <div className="stat-card stat-card-indigo">
                <div className="stat-value">{activeEmps}</div>
                <div className="stat-label">Active Employees</div>
              </div>
            </div>

            {/* Monthly trend */}
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text)' }}>Monthly Trip Trend</div>
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
                    <linearGradient id="mgkm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#667eea" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#667eea" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip {...tooltipStyle} formatter={(v, name) => [`${v}${name === 'km' ? ' km' : ' trips'}`, name === 'km' ? 'Distance' : 'Trips']} />
                  <Area type="monotone" dataKey="km" stroke="#667eea" strokeWidth={2.5} fill="url(#mgkm)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '1.2rem', marginTop: '0.5rem', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#667eea', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: 14, height: 2.5, background: '#667eea', display: 'inline-block', borderRadius: 2 }} />Distance (km)
                </span>
              </div>
            </div>

            {/* Top Travelers */}
            <div className="card">
              <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text)', marginBottom: '1rem' }}>Top Travelers</div>
              {employeeData.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>No trip data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(180, employeeData.length * 32)}>
                  <BarChart data={employeeData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={64} />
                    <Tooltip {...tooltipStyle} formatter={(v) => [`${v} km`, 'Distance']} />
                    <Bar dataKey="km" fill="#667eea" radius={[0, 4, 4, 0]} maxBarSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              )}
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

              </div>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────────── REPORTS TAB ────────────────────── */}
      {tab === 'reports' && (
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>Monthly Trip Report</h2>

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
              <li>Employee-wise summary (trips, total KM)</li>
              <li>Detailed trip-by-trip breakdown per employee</li>
              <li>Odometer vs GPS distance comparison</li>
              <li>Start and end locations for each trip</li>
            </ul>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem' }}>Employee Summary CSV</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              One row per employee — trips and total KM.
            </p>
            <button className="btn btn-ghost" onClick={exportEmployeeCSV}>Download Employee Summary</button>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setTab('trips')}>
              View All Trips →
            </button>
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
              const monthKm = Math.round(monthTrips.reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0));
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
                    {empTrips.length > 0 && (
                      <span className="badge badge-approved" style={{ flexShrink: 0 }}>Active</span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div style={{ background: 'var(--surface-2)', borderRadius: '8px', padding: '0.5rem 0.65rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>This Month</div>
                      <div style={{ fontWeight: '700', color: 'var(--text)', fontSize: '0.9rem' }}>{monthTrips.length} trips</div>
                    </div>
                    <div style={{ background: 'var(--surface-2)', borderRadius: '8px', padding: '0.5rem 0.65rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Monthly KM</div>
                      <div style={{ fontWeight: '700', color: 'var(--text)', fontSize: '0.9rem' }}>{monthKm} km</div>
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
        const missingOdo = trips.filter(t => t.status !== 'active' && t.start_odometer == null && t.end_odometer == null);
        const missingPurpose = trips.filter(t => !t.purpose || t.purpose.trim() === '');
        const total = missingOdo.length + missingPurpose.length;
        return (
          <div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              {[
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
              title="Missing Odometer Reading"
              description="Completed trips where neither start nor end odometer was recorded"
              items={missingOdo}
              color="#f59e0b"
            />
            <IssueList
              title="Missing Trip Purpose"
              description="Trips submitted without a purpose description"
              items={missingPurpose}
              color="#8b5cf6"
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

    </div>
  );
}
