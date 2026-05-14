import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const currentIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

function haversineKm(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lat1, lng1] = coords[i - 1];
    const [lat2, lng2] = coords[i];
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

function MapFollow({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.setView(pos, Math.max(map.getZoom(), 14));
  }, [pos, map]);
  return null;
}

function formatElapsed(startTime) {
  const ms = Date.now() - new Date(startTime).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}

const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric'];

export default function ActiveTrip() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [route, setRoute] = useState([]);
  const [currentPos, setCurrentPos] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [elapsed, setElapsed] = useState('');

  // End-trip form state
  const [endOdometer, setEndOdometer] = useState('');
  const [fuel, setFuel] = useState({ enabled: false, type: 'Petrol', liters: '', amount: '' });
  const [receipts, setReceipts] = useState([]); // File objects
  const [receiptPreviews, setReceiptPreviews] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const socketRef = useRef(null);
  const watchRef = useRef(null);
  const lastSendRef = useRef(0);

  // Load active trip and existing GPS track
  useEffect(() => {
    const init = async () => {
      try {
        const res = await axios.get('/api/trips/active');
        if (!res.data) { navigate('/'); return; }
        setTrip(res.data);
        const trackRes = await axios.get(`/api/gps/trip/${res.data.id}`);
        const pts = trackRes.data.map(p => [parseFloat(p.latitude), parseFloat(p.longitude)]);
        setRoute(pts);
        if (pts.length > 0) setCurrentPos(pts[pts.length - 1]);
      } catch {
        navigate('/');
      }
    };
    init();
  }, []);

  // GPS watch + socket
  useEffect(() => {
    if (!trip) return;
    socketRef.current = io({ path: '/socket.io' });

    watchRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const pt = [coords.latitude, coords.longitude];
        setCurrentPos(pt);
        setSpeed(coords.speed ? coords.speed * 3.6 : 0);
        setRoute(prev => {
          const last = prev[prev.length - 1];
          if (last && Math.abs(last[0] - coords.latitude) < 0.00009 && Math.abs(last[1] - coords.longitude) < 0.00009) return prev;
          return [...prev, pt];
        });

        const now = Date.now();
        if (now - lastSendRef.current > 15000) {
          lastSendRef.current = now;
          axios.post('/api/gps/track', { trip_id: trip.id, latitude: coords.latitude, longitude: coords.longitude, speed: coords.speed ?? 0 });
          socketRef.current?.emit('gps:update', { userId: user.id, name: user.name, tripId: trip.id, lat: coords.latitude, lng: coords.longitude, speed: coords.speed ?? 0 });
        }
      },
      (err) => {
        if (err.code === 1) setError('GPS denied — only odometer distance will be used for billing.');
        else setError('GPS error: ' + err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchRef.current);
      socketRef.current?.disconnect();
    };
  }, [trip]);

  // Elapsed timer
  useEffect(() => {
    if (!trip) return;
    setElapsed(formatElapsed(trip.start_time));
    const t = setInterval(() => setElapsed(formatElapsed(trip.start_time)), 1000);
    return () => clearInterval(t);
  }, [trip]);

  const handleReceiptChange = (e) => {
    const files = Array.from(e.target.files);
    setReceipts(files);
    setReceiptPreviews(files.map(f => ({ name: f.name, url: URL.createObjectURL(f) })));
  };

  const endTrip = async () => {
    if (!window.confirm('End this trip and submit for approval?')) return;
    setLoading(true);
    setError('');
    try {
      const gpsKm = Math.round(haversineKm(route) * 100) / 100;

      // Upload receipts first (before status changes)
      if (receipts.length > 0) {
        const fd = new FormData();
        receipts.forEach(f => fd.append('receipts', f));
        await axios.post(`/api/receipts/${trip.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // End trip
      await axios.post(`/api/trips/end/${trip.id}`, {
        end_odometer: endOdometer || null,
        end_lat: currentPos?.[0] ?? null,
        end_lng: currentPos?.[1] ?? null,
        end_address: currentPos ? `${currentPos[0].toFixed(5)}, ${currentPos[1].toFixed(5)}` : null,
        gps_distance_km: gpsKm,
        fuel_expense_amount: fuel.enabled && fuel.amount ? parseFloat(fuel.amount) : 0,
        fuel_liters: fuel.enabled && fuel.liters ? parseFloat(fuel.liters) : null,
        fuel_type: fuel.enabled ? fuel.type : null,
      });

      socketRef.current?.emit('gps:stop', { userId: user.id });
      navigate('/trips');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to end trip');
    } finally {
      setLoading(false);
    }
  };

  if (!trip) {
    return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}><p style={{ color: '#64748b' }}>Loading trip...</p></div>;
  }

  const gpsKm = haversineKm(route);
  const odomKm = trip.start_odometer && endOdometer
    ? Math.max(0, parseFloat(endOdometer) - parseFloat(trip.start_odometer))
    : null;
  const fuelAmt = fuel.enabled && fuel.amount ? parseFloat(fuel.amount) : 0;
  const center = currentPos ?? (route[0] || [20.5937, 78.9629]);
  const startPt = trip.start_lat ? [parseFloat(trip.start_lat), parseFloat(trip.start_lng)] : null;

  return (
    <div>
      <div className="page-header">
        <h1>Active Trip</h1>
        <p>{trip.purpose}{trip.vehicle_name ? ` · ${trip.vehicle_name}` : ''}</p>
      </div>

      {error && <div className="alert alert-warn">{error}</div>}

      {/* Live stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{gpsKm.toFixed(2)}</div>
          <div className="stat-label">GPS km</div>
        </div>
        {odomKm != null && (
          <div className="stat-card">
            <div className="stat-value">{odomKm.toFixed(1)}</div>
            <div className="stat-label">Odometer km</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-value">{speed.toFixed(0)}</div>
          <div className="stat-label">km/h</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{elapsed}</div>
          <div className="stat-label">Duration</div>
        </div>
      </div>

      {/* Map */}
      <div className="map-container" style={{ height: '360px' }}>
        <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
          {route.length > 1 && <Polyline positions={route} color="#1e40af" weight={4} opacity={0.85} />}
          {startPt && <Marker position={startPt}><Popup>Trip Start · {new Date(trip.start_time).toLocaleTimeString()}</Popup></Marker>}
          {currentPos && <Marker position={currentPos} icon={currentIcon}><Popup>Current · {speed.toFixed(1)} km/h</Popup></Marker>}
          <MapFollow pos={currentPos} />
        </MapContainer>
      </div>

      {/* ── End trip form ── */}
      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>End Trip Details</h2>

        {/* Odometer */}
        <div className="form-group">
          <label>End Odometer Reading (km)</label>
          <input
            type="number"
            value={endOdometer}
            onChange={e => setEndOdometer(e.target.value)}
            placeholder={trip.start_odometer ? `Started at ${parseFloat(trip.start_odometer).toFixed(1)} km` : 'Optional'}
            min={trip.start_odometer || 0}
            step="0.1"
          />
        </div>
        {odomKm != null && (
          <div className="alert alert-info" style={{ marginBottom: '1rem', fontSize: '0.82rem' }}>
            Odometer: <strong>{odomKm.toFixed(1)} km</strong> · GPS: <strong>{gpsKm.toFixed(2)} km</strong> · Odometer used for billing
          </div>
        )}

        {/* ── Fuel expense ── */}
        <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', marginBottom: fuel.enabled ? '0.85rem' : 0 }}>
            <input
              type="checkbox"
              checked={fuel.enabled}
              onChange={e => setFuel({ ...fuel, enabled: e.target.checked })}
              style={{ width: 'auto' }}
            />
            Add Fuel Expense
          </label>

          {fuel.enabled && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0 1rem' }}>
              <div className="form-group">
                <label>Fuel Type</label>
                <select value={fuel.type} onChange={e => setFuel({ ...fuel, type: e.target.value })}>
                  {FUEL_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Liters Filled (optional)</label>
                <input
                  type="number"
                  value={fuel.liters}
                  onChange={e => setFuel({ ...fuel, liters: e.target.value })}
                  placeholder="e.g. 5.5"
                  min="0"
                  step="0.1"
                />
              </div>
              <div className="form-group">
                <label>Amount Paid (Rs.) *</label>
                <input
                  type="number"
                  value={fuel.amount}
                  onChange={e => setFuel({ ...fuel, amount: e.target.value })}
                  placeholder="e.g. 350"
                  min="0"
                  step="1"
                  required={fuel.enabled}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Receipt upload ── */}
        <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.6rem' }}>Receipts / Proof (optional, max 6 files)</div>
          <input
            type="file"
            accept="image/*,.pdf"
            multiple
            onChange={handleReceiptChange}
            style={{ fontSize: '0.875rem' }}
          />
          {receiptPreviews.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
              {receiptPreviews.map((p, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img
                    src={p.url}
                    alt={p.name}
                    style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div style={{ fontSize: '0.68rem', color: '#64748b', maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary before submitting */}
        {(odomKm != null || fuelAmt > 0) && (
          <div className="alert alert-success" style={{ marginBottom: '1rem', fontSize: '0.82rem' }}>
            KM expense: <strong>Rs.{((odomKm ?? gpsKm) * 0).toFixed(0)}</strong> (calculated server-side) ·
            Fuel: <strong>Rs.{fuelAmt.toFixed(0)}</strong>
          </div>
        )}

        <button
          className="btn btn-danger"
          onClick={endTrip}
          disabled={loading || (fuel.enabled && !fuel.amount)}
          style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}
        >
          {loading ? 'Submitting...' : 'End Trip & Submit for Approval'}
        </button>
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.6rem' }}>
          GPS route, odometer, fuel, and receipts will all be saved
        </p>
      </div>
    </div>
  );
}
