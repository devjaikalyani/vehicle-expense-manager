import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function fmt(n) { return parseFloat(n || 0).toFixed(1); }
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function avatarColor(name) {
  const colors = ['#667eea', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f5576c'];
  return colors[(name || '').charCodeAt(0) % colors.length];
}

function Avatar({ name, size = 38 }) {
  const initials = (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: avatarColor(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontSize: size * 0.38, fontWeight: '700', flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function getMonthlyData(trips) {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthTrips = trips.filter(t => {
      const td = new Date(t.start_time);
      return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
    });
    return {
      label: d.toLocaleString('en-IN', { month: 'short' }),
      trips: monthTrips.length,
      km: Math.round(monthTrips.reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0)),
    };
  });
}

function StatCard({ value, label, gradClass }) {
  return (
    <div className={`stat-card ${gradClass}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTrip, setActiveTrip] = useState(null);
  const [trips, setTrips] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ purpose: '', start_odometer: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gpsStatus, setGpsStatus] = useState('');
  const [elapsed, setElapsed] = useState('');

  const isManager = user.role === 'manager' || user.role === 'admin';

  const fetchData = async () => {
    try {
      const [activeRes, tripsRes] = await Promise.all([
        axios.get('/api/trips/active'),
        axios.get('/api/trips'),
      ]);
      setActiveTrip(activeRes.data);
      setTrips(tripsRes.data.filter(t => t.status !== 'active'));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!activeTrip) { setElapsed(''); return; }
    const tick = () => {
      const ms = Date.now() - new Date(activeTrip.start_time).getTime();
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
      setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [activeTrip]);

  const getPosition = () =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 })
    );

  const startTrip = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setGpsStatus('Getting GPS location...');
    try {
      const pos = await getPosition();
      setGpsStatus('Starting trip...');
      await axios.post('/api/trips/start', {
        purpose: form.purpose,
        start_odometer: form.start_odometer || null,
        start_lat: pos.coords.latitude,
        start_lng: pos.coords.longitude,
        start_address: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
      });
      await fetchData();
      navigate('/trip/active');
    } catch (err) {
      if (err.code === 1) setError('Location access denied. Please enable GPS in your browser settings.');
      else setError(err.response?.data?.error || 'Failed to start trip. Try again.');
    } finally {
      setLoading(false);
      setGpsStatus('');
    }
  };

  const completedTrips = trips.filter(t => t.status !== 'active');
  const thisMonthTrips = completedTrips.filter(t => {
    const d = new Date(t.start_time), now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalKm = completedTrips.reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0);

  return (
    <div>
      {/* Welcome header */}
      <div className="gradient-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Avatar name={user.name} size={48} />
            <div>
              <h1 style={{ fontSize: '1.3rem' }}>Welcome back, {user.name.split(' ')[0]}</h1>
              <p>
                {user.employee_code && <span style={{ fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginRight: '0.5rem' }}>{user.employee_code}</span>}
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          {!activeTrip && (
            <button
              className="btn"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}
              onClick={() => setShowForm(true)}
            >
              + Start Trip
            </button>
          )}
          {activeTrip && (
            <button
              className="btn"
              style={{ background: 'rgba(239,68,68,0.85)', color: 'white', border: '1px solid rgba(239,68,68,0.5)', backdropFilter: 'blur(8px)' }}
              onClick={() => navigate('/trip/active')}
            >
              Trip in Progress →
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="stats-grid">
        <StatCard value={fmt(totalKm)} label="Total KM" gradClass="stat-card-indigo" />
        <StatCard value={thisMonthTrips.length} label="This Month" gradClass="stat-card-indigo" />
      </div>


      {/* Active trip banner */}
      {activeTrip && (
        <div className="alert alert-info" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span>
            <strong>Trip in progress</strong> — {activeTrip.purpose || 'Unnamed trip'} ·{' '}
            {new Date(activeTrip.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            {elapsed && <span style={{ marginLeft: '0.4rem', fontWeight: '700' }}>({elapsed})</span>}
          </span>
          <button className="btn btn-danger btn-sm" onClick={() => navigate('/trip/active')}>Open →</button>
        </div>
      )}

      {/* Start trip form */}
      {!activeTrip && showForm && (
        <div className="card" style={{ borderTop: '3px solid #667eea' }}>
          <div className="section-header">
            <span className="section-title">New Trip</span>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setError(''); }}>Cancel</button>
          </div>
          <form onSubmit={startTrip}>
            {error && <div className="alert alert-error">{error}</div>}
            {gpsStatus && <div className="alert alert-info">{gpsStatus}</div>}
            <div className="form-group">
              <label>Start Odometer (km) — optional</label>
              <input type="number" value={form.start_odometer} onChange={e => setForm({ ...form, start_odometer: e.target.value })} placeholder="e.g. 12500" min="0" step="0.1" />
            </div>
            <div className="form-group">
              <label>Purpose / Destination *</label>
              <input value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. Client visit — ABC Pumps, Nagpur" required />
            </div>
            <button type="submit" className="btn btn-success" style={{ width: '100%', padding: '0.85rem' }} disabled={loading}>
              {loading ? gpsStatus || 'Starting...' : 'Start Trip'}
            </button>
          </form>
        </div>
      )}

      {/* Manager shortcut */}
      {isManager && (
        <div style={{
          background: 'linear-gradient(135deg, #1a1040, #2d1b69)',
          borderRadius: '18px',
          padding: '1.1rem 1.35rem',
          marginBottom: '1.1rem',
          border: '1px solid rgba(139,92,246,0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        }}>
          <div>
            <div style={{ fontWeight: '700', color: '#c4b5fd', fontSize: '0.95rem' }}>Manager Console</div>
            <div style={{ fontSize: '0.82rem', color: 'rgba(196,181,253,0.6)', marginTop: '0.1rem' }}>Review pending claims and live map</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to="/manager" className="btn btn-sm" style={{ background: 'rgba(139,92,246,0.25)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}>Dashboard</Link>
            <Link to="/live-map" className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}>Live Map</Link>
          </div>
        </div>
      )}

      {/* Recent trips */}
      <div className="card">
        <div className="section-header">
          <span className="section-title">Recent Trips</span>
          <Link to="/trips" style={{ color: 'var(--brand-1)', textDecoration: 'none', fontSize: '0.82rem', fontWeight: '600' }}>View all →</Link>
        </div>

        {completedTrips.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9190a4" strokeWidth="1.5">
                <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <p>No trips yet. Start your first trip above.</p>
          </div>
        ) : (
          completedTrips.slice(0, 10).map((trip, i) => (
            <div key={trip.id}>
              {i > 0 && <hr className="trip-divider" />}
              <div className={`trip-row trip-item trip-item-${trip.status}`}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {trip.purpose || 'Trip'}
                  </div>
                  {isManager && trip.employee_name && (
                    <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--brand-1)', marginBottom: '0.1rem' }}>
                      {trip.employee_name}{trip.employee_code ? ` (${trip.employee_code})` : ''}
                    </div>
                  )}
                  <div className="trip-meta">
                    <span>{fmtDate(trip.start_time)}</span>
                    {trip.vehicle_name && <span>{trip.vehicle_name}</span>}
                    <span>{fmt(trip.manual_distance_km || trip.gps_distance_km)} km</span>
                  </div>
                </div>
                <span className={`badge badge-${trip.status}`}>{trip.status}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
