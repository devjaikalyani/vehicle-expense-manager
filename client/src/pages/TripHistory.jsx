import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected'];

function fmt(n) { return parseFloat(n || 0).toFixed(1); }
function fmtINR(n) { return '₹' + parseFloat(n || 0).toFixed(0); }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtTime(d) { return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
function duration(start, end) {
  if (!end) return '—';
  const ms = new Date(end) - new Date(start);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function ReceiptsSection({ tripId }) {
  const [receipts, setReceipts] = useState(null);

  useEffect(() => {
    axios.get(`/api/receipts/${tripId}`).then(r => setReceipts(r.data));
  }, [tripId]);

  if (receipts === null) return <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Loading receipts...</span>;
  if (receipts.length === 0) return <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>No receipts attached</span>;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
      {receipts.map(r => (
        <a
          key={r.id}
          href={`/uploads/${r.filename}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}
        >
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '0.3rem 0.6rem',
            fontSize: '0.75rem',
            color: '#1e40af',
            fontWeight: '600',
          }}>
            {r.original_name || r.filename}
          </div>
        </a>
      ))}
    </div>
  );
}

export default function TripHistory() {
  const { user } = useAuth();
  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const [trips, setTrips] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const applySearch = () => setSearch(searchInput.trim());
  const clearSearch = () => { setSearchInput(''); setSearch(''); };

  useEffect(() => {
    axios.get('/api/trips').then(res => {
      setTrips(res.data.filter(t => t.status !== 'active'));
      setLoading(false);
    });
  }, []);

  const filtered = (filter === 'all' ? trips : trips.filter(t => t.status === filter))
    .filter(t => !search ||
      (t.purpose || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.vehicle_name || '').toLowerCase().includes(search.toLowerCase())
    );
  const totalKm = filtered.reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0);
  const totalExp = filtered.reduce((s, t) => s + parseFloat(t.expense_amount || 0), 0);
  const approvedExp = filtered.filter(t => t.status === 'approved').reduce((s, t) => s + parseFloat(t.expense_amount || 0), 0);

  const exportCSV = () => {
    const rows = [
      ['Date', 'Purpose', 'Vehicle', 'Start Odo', 'End Odo', 'Odometer KM', 'GPS KM', 'Fuel Type', 'Fuel Liters', 'Fuel Exp', 'Total Exp', 'Status', 'Manager Notes'],
      ...filtered.map(t => [
        fmtDate(t.start_time),
        t.purpose || '',
        t.vehicle_name ? `${t.vehicle_name} (${t.registration_number})` : '',
        t.start_odometer || '',
        t.end_odometer || '',
        fmt(t.manual_distance_km),
        fmt(t.gps_distance_km),
        t.fuel_type || '',
        t.fuel_liters || '',
        parseFloat(t.fuel_expense_amount || 0).toFixed(2),
        parseFloat(t.expense_amount || 0).toFixed(2),
        t.status,
        t.manager_notes || '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `trips-${filter}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="gradient-header">
        <h1>Trip History</h1>
        <p>All submitted trips and their approval status</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-card-indigo"><div className="stat-value">{filtered.length}</div><div className="stat-label">Trips</div></div>
        <div className="stat-card stat-card-ocean"><div className="stat-value">{fmt(totalKm)}</div><div className="stat-label">Total KM</div></div>
        <div className="stat-card stat-card-indigo"><div className="stat-value">{fmtINR(totalExp)}</div><div className="stat-label">Claimed</div></div>
        <div className="stat-card stat-card-emerald"><div className="stat-value">{fmtINR(approvedExp)}</div><div className="stat-label">Approved</div></div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div className="filter-pills" style={{ marginBottom: 0 }}>
            {STATUS_FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`pill ${filter === f ? 'pill-active' : 'pill-inactive'}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}>Export CSV</button>
        </div>
        {/* Search bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.85rem',
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
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applySearch()}
            placeholder="Search by purpose or vehicle..."
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
          {searchInput && (
            <button
              onClick={clearSearch}
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
            onClick={applySearch}
            style={{ flexShrink: 0, padding: '0.3rem 0.9rem' }}
          >
            Search
          </button>
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>No trips in this category.</p>
        ) : (
          filtered.map((trip, i) => (
            <div key={trip.id}>
              {i > 0 && <hr className="trip-divider" />}
              <div
                className={`trip-item trip-item-${trip.status}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setExpanded(expanded === trip.id ? null : trip.id)}
              >
                <div className="trip-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '700', color: '#0f172a' }}>{trip.purpose || 'Trip'}</div>
                    {isManager && trip.employee_name && (
                      <div style={{ fontSize: '0.78rem', fontWeight: '600', color: '#1e40af', marginBottom: '0.15rem' }}>
                        {trip.employee_name}{trip.employee_code ? ` (${trip.employee_code})` : ''}
                      </div>
                    )}
                    <div className="trip-meta">
                      <span>{fmtDate(trip.start_time)}, {fmtTime(trip.start_time)}</span>
                      <span>Duration: {duration(trip.start_time, trip.end_time)}</span>
                      {trip.vehicle_name && <span>{trip.vehicle_name}</span>}
                    </div>
                    <div className="trip-meta" style={{ marginTop: '0.2rem' }}>
                      {trip.manual_distance_km != null && <span>Odo: <strong>{fmt(trip.manual_distance_km)} km</strong></span>}
                      {trip.gps_distance_km != null && <span>GPS: <strong>{fmt(trip.gps_distance_km)} km</strong></span>}
                      {parseFloat(trip.fuel_expense_amount || 0) > 0 && (
                        <span>Fuel ({trip.fuel_type}): <strong>{fmtINR(trip.fuel_expense_amount)}</strong></span>
                      )}
                      <span style={{ fontWeight: '700', color: '#1e40af', fontSize: '0.9rem' }}>{fmtINR(trip.expense_amount)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                    <span className={`badge badge-${trip.status}`}>{trip.status}</span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{expanded === trip.id ? 'Hide' : 'Details'}</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded === trip.id && (
                  <div
                    style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.85rem', marginTop: '0.75rem', fontSize: '0.82rem' }}
                    onClick={e => e.stopPropagation()}
                  >
                    {trip.start_odometer && <div style={{ color: '#475569' }}>Start odometer: {parseFloat(trip.start_odometer).toFixed(1)} km</div>}
                    {trip.end_odometer && <div style={{ color: '#475569' }}>End odometer: {parseFloat(trip.end_odometer).toFixed(1)} km</div>}
                    {trip.fuel_liters && <div style={{ color: '#475569' }}>Fuel filled: {trip.fuel_liters} L ({trip.fuel_type})</div>}
                    {trip.manager_notes && (
                      <div style={{ marginTop: '0.4rem', color: '#92400e', fontStyle: 'italic' }}>
                        Manager note: {trip.manager_notes}
                      </div>
                    )}
                    {trip.approved_at && (
                      <div style={{ color: '#64748b', marginTop: '0.3rem' }}>
                        {trip.status === 'approved' ? 'Approved' : 'Rejected'} on: {fmtDate(trip.approved_at)}
                      </div>
                    )}
                    <div style={{ marginTop: '0.6rem', fontWeight: '600', color: '#475569' }}>Receipts:</div>
                    <ReceiptsSection tripId={trip.id} />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
