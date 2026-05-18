import { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function fmt(n) { return parseFloat(n || 0).toFixed(1); }
function fmtINR(n) { return '₹' + parseFloat(n || 0).toFixed(0); }
function fmtTime(d) { return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
function fmtDateStr(s) {
  const [y, m, d] = s.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayISO() { return localISO(new Date()); }

function FitRoute({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) { map.setView(points[0], 15); return; }
    const bounds = L.latLngBounds(points);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  }, [points.length]);
  return null;
}

export default function TripTimeline() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    axios.get('/api/employees').then(r => setEmployees(r.data));
  }, []);

  useEffect(() => {
    if (!selectedEmp || !selectedDate) { setTrips([]); return; }
    setLoading(true);
    setActiveTrip(null);
    setGpsPoints([]);
    axios.get(`/api/trips?employee_id=${selectedEmp}&date=${selectedDate}`)
      .then(r => setTrips(r.data))
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, [selectedEmp, selectedDate]);

  const toggleRoute = async (trip) => {
    if (activeTrip === trip.id) {
      setActiveTrip(null);
      setGpsPoints([]);
      return;
    }
    setActiveTrip(trip.id);
    setGpsLoading(true);
    try {
      const res = await axios.get(`/api/gps/trip/${trip.id}`);
      setGpsPoints(res.data.map(p => [parseFloat(p.latitude), parseFloat(p.longitude)]));
    } catch {
      setGpsPoints([]);
    } finally {
      setGpsLoading(false);
    }
  };

  const empName = employees.find(e => String(e.id) === selectedEmp)?.name || '';
  const totalKm = trips.reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0);
  const totalExp = trips.reduce((s, t) => s + parseFloat(t.expense_amount || 0), 0);

  return (
    <div>
      <div className="gradient-header">
        <h1 style={{ fontSize: '1.3rem' }}>Trip Timeline</h1>
        <p style={{ marginTop: '0.25rem' }}>View route and trip log for any employee on any day</p>
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Employee</label>
            <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
              <option value="">Select employee...</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name}{e.employee_code ? ` (${e.employee_code})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Date</label>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ flexShrink: 0, padding: '0.45rem 0.7rem' }}
                onClick={() => {
                  const d = new Date(selectedDate + 'T00:00:00');
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(localISO(d));
                }}
              >&#8592;</button>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                max={todayISO()}
                style={{ flex: 1, minWidth: 0 }}
              />
              <button
                className="btn btn-ghost btn-sm"
                style={{ flexShrink: 0, padding: '0.45rem 0.7rem' }}
                disabled={selectedDate >= todayISO()}
                onClick={() => {
                  const d = new Date(selectedDate + 'T00:00:00');
                  d.setDate(d.getDate() + 1);
                  const next = localISO(d);
                  if (next <= todayISO()) setSelectedDate(next);
                }}
              >&#8594;</button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ flexShrink: 0 }}
                onClick={() => setSelectedDate(todayISO())}
              >Today</button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {selectedEmp && trips.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="stat-card stat-card-indigo" style={{ flex: '1 1 120px', padding: '0.75rem 1rem' }}>
            <div className="stat-value" style={{ fontSize: '1.4rem' }}>{trips.length}</div>
            <div className="stat-label">Trips</div>
          </div>
          <div className="stat-card stat-card-ocean" style={{ flex: '1 1 120px', padding: '0.75rem 1rem' }}>
            <div className="stat-value" style={{ fontSize: '1.4rem' }}>{fmt(totalKm)}</div>
            <div className="stat-label">Total KM</div>
          </div>
          <div className="stat-card stat-card-amber" style={{ flex: '1 1 120px', padding: '0.75rem 1rem' }}>
            <div className="stat-value" style={{ fontSize: '1.4rem' }}>{fmtINR(totalExp)}</div>
            <div className="stat-label">Total Expense</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Trip list */}
        <div style={{ flex: '0 1 340px', minWidth: '280px' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid var(--border-solid)',
              fontWeight: '700', fontSize: '0.9rem', color: 'var(--text)',
            }}>
              {loading ? 'Loading...' : selectedEmp
                ? `${empName} — ${fmtDateStr(selectedDate)}`
                : 'Select an employee and date'}
            </div>

            {!selectedEmp ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <div style={{ marginBottom: '0.5rem', opacity: 0.35 }}>
                  <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                Select an employee above to view their trips.
              </div>
            ) : loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading trips...</div>
            ) : trips.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No trips on this date.
              </div>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {trips.map((trip, i) => (
                  <div
                    key={trip.id}
                    onClick={() => toggleRoute(trip)}
                    style={{
                      padding: '0.85rem 1rem',
                      borderBottom: i < trips.length - 1 ? '1px solid var(--border-solid)' : 'none',
                      cursor: 'pointer',
                      background: activeTrip === trip.id ? 'rgba(102,126,234,0.07)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', fontSize: '0.88rem', color: 'var(--text)' }}>
                          {trip.purpose || 'Trip'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {fmtTime(trip.start_time)}{trip.end_time ? ` — ${fmtTime(trip.end_time)}` : ' (active)'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                          {(trip.manual_distance_km || trip.gps_distance_km) && (
                            <span>{fmt(trip.manual_distance_km || trip.gps_distance_km)} km</span>
                          )}
                          {trip.vehicle_name && <span>{trip.vehicle_name}</span>}
                          <span style={{ color: 'var(--brand-1)', fontWeight: '600' }}>{fmtINR(trip.expense_amount)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0 }}>
                        <span className={`badge badge-${trip.status}`}>{trip.status}</span>
                        {activeTrip === trip.id && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--brand-1)', fontWeight: '600' }}>
                            {gpsLoading ? 'Loading...' : 'Route shown'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div className="map-container" style={{ height: '520px' }}>
            <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>'
              />
              {gpsPoints.length > 1 && (
                <>
                  <Polyline positions={gpsPoints} color="#667eea" weight={4} opacity={0.85} />
                  <Marker position={gpsPoints[0]}>
                    <Popup><div style={{ fontWeight: '600' }}>Start</div></Popup>
                  </Marker>
                  <Marker position={gpsPoints[gpsPoints.length - 1]}>
                    <Popup><div style={{ fontWeight: '600' }}>End</div></Popup>
                  </Marker>
                </>
              )}
              {gpsPoints.length === 1 && (
                <Marker position={gpsPoints[0]}>
                  <Popup><div style={{ fontWeight: '600' }}>Trip location</div></Popup>
                </Marker>
              )}
              <FitRoute points={gpsPoints} />
            </MapContainer>
          </div>
          {activeTrip && !gpsLoading && gpsPoints.length === 0 && (
            <div style={{ textAlign: 'center', padding: '0.65rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No GPS data recorded for this trip.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
