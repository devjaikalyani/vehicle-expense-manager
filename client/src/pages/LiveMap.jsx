import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function FitBounds({ locations }) {
  const map = useMap();
  useEffect(() => {
    const locs = Object.values(locations);
    if (locs.length === 0) return;
    if (locs.length === 1) {
      map.setView([locs[0].lat, locs[0].lng], 14);
    } else {
      const bounds = L.latLngBounds(locs.map(l => [l.lat, l.lng]));
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [Object.keys(locations).length]);
  return null;
}

export default function LiveMap() {
  const [locations, setLocations] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io({ path: '/socket.io' });

    socketRef.current.on('gps:locations', (data) => {
      setLocations(data);
      setLastUpdate(new Date());
    });

    socketRef.current.on('gps:update', (data) => {
      setLocations(prev => ({ ...prev, [String(data.userId)]: data }));
      setLastUpdate(new Date());
    });

    return () => socketRef.current?.disconnect();
  }, []);

  const activeCount = Object.keys(locations).length;

  return (
    <div>
      <div className="page-header">
        <h1>Live Employee Map</h1>
        <p>
          {activeCount === 0
            ? 'No employees currently active'
            : `${activeCount} employee${activeCount > 1 ? 's' : ''} active`}
          {lastUpdate && (
            <span style={{ marginLeft: '0.5rem', color: '#94a3b8' }}>
              · updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </p>
      </div>

      {activeCount === 0 && (
        <div className="alert alert-info">
          Waiting for employees to start trips. Locations will appear here automatically.
        </div>
      )}

      <div className="map-container" style={{ height: '480px' }}>
        <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          />
          {Object.entries(locations).map(([userId, loc]) => (
            <Marker key={userId} position={[loc.lat, loc.lng]}>
              <Popup>
                <strong style={{ display: 'block' }}>{loc.name}</strong>
                {loc.speed != null && (
                  <span style={{ display: 'block', color: '#475569', fontSize: '0.85rem' }}>
                    Speed: {(loc.speed * 3.6).toFixed(1)} km/h
                  </span>
                )}
                {loc.timestamp && (
                  <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem' }}>
                    {new Date(loc.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </Popup>
            </Marker>
          ))}
          <FitBounds locations={locations} />
        </MapContainer>
      </div>

      {/* Active employees list */}
      {activeCount > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem' }}>
            Active Employees
          </h2>
          {Object.values(locations).map(loc => (
            <div
              key={loc.userId}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid #f1f5f9' }}
            >
              <div>
                <div style={{ fontWeight: '600', color: '#0f172a' }}>{loc.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {loc.lat?.toFixed(5)}, {loc.lng?.toFixed(5)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: '600', color: '#1e40af', fontSize: '0.9rem' }}>
                  {loc.speed != null ? `${(loc.speed * 3.6).toFixed(1)} km/h` : '—'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {loc.timestamp ? new Date(loc.timestamp).toLocaleTimeString() : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
