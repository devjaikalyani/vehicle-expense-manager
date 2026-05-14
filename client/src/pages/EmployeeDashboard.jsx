import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

function fmt(n) { return parseFloat(n || 0).toFixed(1); }
function fmtINR(n) { return '₹' + parseFloat(n || 0).toFixed(0); }
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTrip, setActiveTrip] = useState(null);
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicle_id: '', purpose: '', start_odometer: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gpsStatus, setGpsStatus] = useState('');

  const isManager = user.role === 'manager' || user.role === 'admin';

  const fetchData = async () => {
    try {
      const [activeRes, tripsRes, vehiclesRes] = await Promise.all([
        axios.get('/api/trips/active'),
        axios.get('/api/trips'),
        axios.get('/api/employees/vehicles'),
      ]);
      setActiveTrip(activeRes.data);
      setTrips(tripsRes.data.filter(t => t.status !== 'active').slice(0, 10));
      setVehicles(vehiclesRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchData(); }, []);

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
        vehicle_id: form.vehicle_id || null,
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
    const d = new Date(t.start_time);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalKm = completedTrips.reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0);
  const totalExp = completedTrips.reduce((s, t) => s + parseFloat(t.expense_amount || 0), 0);
  const pendingAmt = completedTrips.filter(t => t.status === 'pending').reduce((s, t) => s + parseFloat(t.expense_amount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1>Welcome back, {user.name.split(' ')[0]}</h1>
        <p>
          {user.employee_code && <strong>{user.employee_code} · </strong>}
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Quick stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{fmt(totalKm)}</div>
          <div className="stat-label">Total KM</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fmtINR(totalExp)}</div>
          <div className="stat-label">Total Claimed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: pendingAmt > 0 ? '#d97706' : '#16a34a' }}>{fmtINR(pendingAmt)}</div>
          <div className="stat-label">Pending Approval</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{thisMonthTrips.length}</div>
          <div className="stat-label">Trips This Month</div>
        </div>
      </div>

      {/* Active trip banner */}
      {activeTrip && (
        <div className="alert alert-info" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span>
            <strong>Trip in progress</strong> — {activeTrip.purpose || 'Unnamed trip'} started at{' '}
            {new Date(activeTrip.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button className="btn btn-danger btn-sm" onClick={() => navigate('/trip/active')}>
            Open Active Trip →
          </button>
        </div>
      )}

      {/* Start trip card */}
      {!activeTrip && (
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem', color: '#0f172a' }}>
            Start a New Trip
          </h2>
          {!showForm ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                + Start Trip
              </button>
              <Link to="/trips" className="btn btn-ghost">View History</Link>
            </div>
          ) : (
            <form onSubmit={startTrip}>
              {error && <div className="alert alert-error">{error}</div>}
              {gpsStatus && <div className="alert alert-info">{gpsStatus}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 1rem' }}>
                <div className="form-group">
                  <label>Vehicle</label>
                  <select value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })}>
                    <option value="">No vehicle / select later</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} · {v.registration_number} ({v.type?.replace('_', '-')})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Start Odometer (km) — optional</label>
                  <input
                    type="number"
                    value={form.start_odometer}
                    onChange={e => setForm({ ...form, start_odometer: e.target.value })}
                    placeholder="e.g. 12500"
                    min="0"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Purpose / Destination *</label>
                <input
                  value={form.purpose}
                  onChange={e => setForm({ ...form, purpose: e.target.value })}
                  placeholder="e.g. Client visit — ABC Pumps, Nagpur"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? gpsStatus || 'Starting...' : 'Start Trip'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setError(''); }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Manager shortcut */}
      {isManager && (
        <div className="card" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ fontWeight: '700', color: '#1e40af' }}>Manager Console</div>
              <div style={{ fontSize: '0.82rem', color: '#3b82f6' }}>Review pending trip claims and live map</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link to="/manager" className="btn btn-primary btn-sm">Dashboard</Link>
              <Link to="/live-map" className="btn btn-outline btn-sm">Live Map</Link>
            </div>
          </div>
        </div>
      )}

      {/* Recent trips */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '700' }}>Recent Trips</h2>
          <Link to="/trips" style={{ color: '#1e40af', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600' }}>
            View all →
          </Link>
        </div>

        {completedTrips.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1.5rem 0' }}>
            No trips yet. Start your first trip above.
          </p>
        ) : (
          completedTrips.map((trip, i) => (
            <div key={trip.id}>
              {i > 0 && <hr className="trip-divider" />}
              <div className="trip-row" style={{ padding: '0.7rem 0' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {trip.purpose || 'Trip'}
                  </div>
                  <div className="trip-meta">
                    <span>{fmtDate(trip.start_time)}</span>
                    {trip.vehicle_name && <span>{trip.vehicle_name}</span>}
                    <span>{fmt(trip.manual_distance_km || trip.gps_distance_km)} km</span>
                    <span style={{ fontWeight: '700', color: '#1e40af' }}>{fmtINR(trip.expense_amount)}</span>
                  </div>
                </div>
                <StatusBadge status={trip.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
