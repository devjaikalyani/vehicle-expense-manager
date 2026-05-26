import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon paths broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});


function StatBox({ label, value, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '14px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', textAlign: 'center' }}>
      <p style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#1e40af', fontWeight: 600 }}>{sub}</p>}
      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: 500 }}>{label}</p>
    </div>
  );
}

function RouteMap({ trip, tracks }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const startIcon = L.divIcon({
      html: `<div style="width:14px;height:14px;border-radius:50%;background:#16a34a;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
      className: '', iconAnchor: [7, 7],
    });
    const endIcon = L.divIcon({
      html: `<div style="width:14px;height:14px;border-radius:50%;background:#dc2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
      className: '', iconAnchor: [7, 7],
    });

    if (tracks.length >= 2) {
      const latlngs = tracks.map(p => [p.latitude, p.longitude]);
      L.polyline(latlngs, { color: '#1e40af', weight: 4, opacity: 0.85 }).addTo(map);
      L.marker(latlngs[0], { icon: startIcon }).bindPopup('Start').addTo(map);
      L.marker(latlngs[latlngs.length - 1], { icon: endIcon }).bindPopup('End').addTo(map);
      map.fitBounds(L.latLngBounds(latlngs), { padding: [30, 30] });
    } else if (trip.start_lat && trip.start_lng) {
      const pts = [[trip.start_lat, trip.start_lng]];
      L.marker([trip.start_lat, trip.start_lng], { icon: startIcon }).bindPopup('Start').addTo(map);
      if (trip.end_lat && trip.end_lng) {
        L.marker([trip.end_lat, trip.end_lng], { icon: endIcon }).bindPopup('End').addTo(map);
        pts.push([trip.end_lat, trip.end_lng]);
        map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
      } else {
        map.setView([trip.start_lat, trip.start_lng], 14);
      }
    } else {
      map.setView([20.5937, 78.9629], 5);
    }

    return () => { map.remove(); mapInstanceRef.current = null; };
  }, [trip, tracks]);

  return <div ref={mapRef} style={{ height: 240, width: '100%', borderRadius: 16, overflow: 'hidden', zIndex: 0 }} />;
}

export default function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    Promise.all([
      api.trip(id),
      api.receipts(id).catch(() => []),
      api.gpsTrack(id).catch(() => []),
    ]).then(([t, r, g]) => {
      setTrip(t);
      setReceipts(r);
      setTracks(g);
    }).catch(() => navigate('/history', { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e40af', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!trip) return null;

  const km = trip.manual_distance_km ?? trip.gps_distance_km;
  const startTime = new Date(trip.start_time);
  const endTime = trip.end_time ? new Date(trip.end_time) : null;
  const durationMs = endTime ? endTime - startTime : null;
  const durationStr = durationMs
    ? (() => { const m = Math.floor(durationMs / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`; })()
    : null;

  const fmt = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const hasMap = tracks.length > 0 || (trip.start_lat && trip.start_lng);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', background: '#f1f5f9', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
        padding: '48px 20px 20px', color: '#fff',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => navigate(-1)} style={{ color: '#fff', lineHeight: 1, flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{trip.purpose || 'Trip'}</h1>
          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
            {startTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {km != null && (
            <StatBox label="Distance" value={`${parseFloat(km).toFixed(1)}`} sub="km" />
          )}
          {durationStr && (
            <StatBox label="Duration" value={durationStr} />
          )}
          <StatBox label="Start Time" value={fmt(startTime)} />
          {endTime && <StatBox label="End Time" value={fmt(endTime)} />}
        </div>

        {/* Distance card */}
        {km != null && (
          <div style={{
            background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
            borderRadius: 18, padding: '18px 20px', marginBottom: 14, color: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Distance Travelled</p>
              <p style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>
                {parseFloat(km).toFixed(1)}
                <span style={{ fontSize: 18, fontWeight: 600, opacity: 0.8 }}> km</span>
              </p>
            </div>
          </div>
        )}

        {/* Route map */}
        {hasMap && (
          <div style={{ marginBottom: 14, borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ background: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>
                {tracks.length > 0 ? `Route · ${tracks.length} GPS points` : 'Route · Start & End'}
              </span>
            </div>
            <RouteMap trip={trip} tracks={tracks} />
          </div>
        )}

        {/* Trip details card */}
        <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {[
            trip.start_address && { label: 'Start Location', value: trip.start_address },
            trip.end_address && { label: 'End Location', value: trip.end_address },
            trip.start_odometer != null && { label: 'Start Odometer', value: `${parseFloat(trip.start_odometer).toLocaleString()} km` },
            trip.end_odometer != null && { label: 'End Odometer', value: `${parseFloat(trip.end_odometer).toLocaleString()} km` },
          ].filter(Boolean).map((row, i, arr) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 16px', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Manager note */}
        {trip.manager_notes && (
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 14, padding: '12px 16px', marginBottom: 14,
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Manager Note</p>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{trip.manager_notes}</p>
          </div>
        )}

        {/* Photos */}
        {receipts.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 18, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
              Photos <span style={{ color: '#94a3b8', fontWeight: 500 }}>({receipts.length})</span>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {receipts.map((r) => (
                <div key={r.id} onClick={() => setLightbox(`/uploads/${r.filename}`)} style={{ cursor: 'pointer', position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
                  <img
                    src={`/uploads/${r.filename}`}
                    alt={r.original_name}
                    style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Photo lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <button onClick={() => setLightbox(null)} style={{
            position: 'absolute', top: 20, right: 20, width: 36, height: 36,
            background: 'rgba(255,255,255,0.15)', borderRadius: '50%', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img
            src={lightbox}
            alt="Full view"
            style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
