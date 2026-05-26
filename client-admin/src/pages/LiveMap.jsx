import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const avatarColors = ['#667eea', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f5576c'];
function avatarColor(name) { return avatarColors[(name || '').charCodeAt(0) % avatarColors.length]; }
function initials(name) { return (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(); }

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function speedColor(kmh) {
  if (kmh < 5) return '#94a3b8';
  if (kmh < 40) return '#10b981';
  if (kmh < 80) return '#f59e0b';
  return '#ef4444';
}

function FitBounds({ locations }) {
  const map = useMap();
  useEffect(() => {
    const locs = Object.values(locations);
    if (locs.length === 0) return;
    if (locs.length === 1) { map.setView([locs[0].lat, locs[0].lng], 14); return; }
    const bounds = L.latLngBounds(locs.map(l => [l.lat, l.lng]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60] });
  }, [Object.keys(locations).length]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 15, { duration: 0.8 });
  }, [target]);
  return null;
}

function makeIcon(name) {
  const color = avatarColor(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
    <ellipse cx="18" cy="41" rx="6" ry="2.5" fill="rgba(0,0,0,0.18)"/>
    <path d="M18 0 C8 0 0 8 0 18 C0 30 18 44 18 44 C18 44 36 30 36 18 C36 8 28 0 18 0Z" fill="${color}"/>
    <circle cx="18" cy="18" r="10" fill="white" fill-opacity="0.92"/>
    <text x="18" y="22" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="${color}" text-anchor="middle">${initials(name)}</text>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [36, 44], iconAnchor: [18, 44], popupAnchor: [0, -44] });
}

export default function LiveMap() {
  const [locations, setLocations] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [empById, setEmpById] = useState({});
  const socketRef = useRef(null);

  useEffect(() => {
    axios.get('/api/employees').then(r => {
      const map = {};
      r.data.forEach(e => { map[String(e.id)] = e; });
      setEmpById(map);
    });
    socketRef.current = io({ path: '/socket.io' });
    socketRef.current.on('gps:locations', (data) => { setLocations(data); setLastUpdate(new Date()); });
    socketRef.current.on('gps:update', (data) => {
      setLocations(prev => ({ ...prev, [String(data.userId)]: data }));
      setLastUpdate(new Date());
    });
    return () => socketRef.current?.disconnect();
  }, []);

  const activeCount = Object.keys(locations).length;
  const locList = Object.values(locations).sort((a, b) => (b.speed ?? 0) - (a.speed ?? 0));

  return (
    <div>
      <div className="gradient-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', position: 'relative', zIndex: 1 }}>
          <div>
            <h1 style={{ fontSize: '1.3rem' }}>Live Employee Map</h1>
            <p style={{ marginTop: '0.25rem' }}>
              {activeCount === 0 ? 'No employees on a trip right now' : `${activeCount} employee${activeCount > 1 ? 's' : ''} tracking live`}
              {lastUpdate && <span style={{ marginLeft: '0.5rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>· updated {lastUpdate.toLocaleTimeString()}</span>}
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '10px', padding: '0.5rem 1.1rem', textAlign: 'center' }}>
            <div style={{ fontWeight: '800', fontSize: '1.5rem', lineHeight: 1 }}>{activeCount}</div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.1rem' }}>Active</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Map */}
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div className="map-container" style={{ height: '520px' }}>
            <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>'
              />
              {locList.map(loc => (
                <Marker key={loc.userId} position={[loc.lat, loc.lng]} icon={makeIcon(loc.name)}>
                  <Popup>
                    <div style={{ minWidth: '150px' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '4px' }}>{loc.name}</div>
                      {loc.speed != null && (
                        <div style={{ color: speedColor(loc.speed * 3.6), fontWeight: '600', fontSize: '0.85rem' }}>
                          {(loc.speed * 3.6).toFixed(1)} km/h
                        </div>
                      )}
                      <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '2px' }}>
                        {loc.lat?.toFixed(4)}, {loc.lng?.toFixed(4)}
                      </div>
                      {loc.timestamp && (
                        <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{timeAgo(loc.timestamp)}</div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
              <FitBounds locations={locations} />
              <FlyTo target={flyTarget} />
            </MapContainer>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: '300px', flexShrink: 0, flex: '0 1 300px', minWidth: '260px' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid var(--border-solid)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text)' }}>Active Employees</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                  {activeCount > 0 ? `${activeCount} on trip` : 'Waiting for employees...'}
                </div>
              </div>
              {activeCount > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 3px rgba(16,185,129,0.25)', display: 'inline-block' }} />
                  <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '700', letterSpacing: '0.04em' }}>LIVE</span>
                </span>
              )}
            </div>

            <div style={{ maxHeight: '466px', overflowY: 'auto' }}>
              {activeCount === 0 ? (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <div style={{ marginBottom: '0.5rem', opacity: 0.4 }}>
                    <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  Locations appear here when employees start trips.
                </div>
              ) : (
                locList.map(loc => {
                  const kmh = loc.speed != null ? loc.speed * 3.6 : null;
                  const isSelected = selectedId === String(loc.userId);
                  return (
                    <div
                      key={loc.userId}
                      onClick={() => {
                        const next = isSelected ? null : String(loc.userId);
                        setSelectedId(next);
                        if (next) setFlyTarget({ lat: loc.lat, lng: loc.lng });
                      }}
                      style={{
                        padding: '0.85rem 1rem',
                        borderBottom: '1px solid var(--border-solid)',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(102,126,234,0.07)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: '50%',
                            background: avatarColor(loc.name),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontSize: '0.8rem', fontWeight: '700',
                          }}>
                            {initials(loc.name)}
                          </div>
                          <span style={{
                            position: 'absolute', bottom: 0, right: 0,
                            width: 10, height: 10, borderRadius: '50%',
                            background: '#10b981', border: '2px solid var(--surface)',
                          }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '600', fontSize: '0.88rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {loc.name}
                          </div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                            {loc.lat?.toFixed(4)}, {loc.lng?.toFixed(4)}
                          </div>
                          {empById[String(loc.userId)]?.phone && (
                            <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                              {empById[String(loc.userId)].phone}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {kmh != null && (
                            <div style={{
                              fontSize: '0.78rem', fontWeight: '700',
                              color: speedColor(kmh),
                              background: `${speedColor(kmh)}1a`,
                              padding: '2px 7px', borderRadius: '6px',
                              display: 'inline-block',
                            }}>
                              {kmh.toFixed(0)} km/h
                            </div>
                          )}
                          {loc.timestamp && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                              {timeAgo(loc.timestamp)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
