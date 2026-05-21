import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';
import { useGpsTracking } from '../useGpsTracking';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function useTimer(startTime) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) return;
    const tick = () => setElapsed(Date.now() - new Date(startTime).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  return elapsed;
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function statusBadge(status) {
  const map = {
    active:   { bg: '#dbeafe', color: '#1e40af', label: 'Active' },
    pending:  { bg: '#fffbeb', color: '#d97706', label: 'Pending' },
    approved: { bg: '#f0fdf4', color: '#16a34a', label: 'Approved' },
    rejected: { bg: '#fef2f2', color: '#dc2626', label: 'Rejected' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20 }}>
      {s.label}
    </span>
  );
}

function LivePositionMap() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    map.setView([20.5937, 78.9629], 13);

    const dotIcon = L.divIcon({
      html: `<div style="width:18px;height:18px;border-radius:50%;background:#1e40af;border:3px solid #fff;box-shadow:0 2px 10px rgba(30,64,175,0.6)"></div>`,
      className: '',
      iconAnchor: [9, 9],
    });

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const latlng = [latitude, longitude];
          if (!markerRef.current) {
            markerRef.current = L.marker(latlng, { icon: dotIcon }).addTo(map);
            map.setView(latlng, 16);
          } else {
            markerRef.current.setLatLng(latlng);
            map.panTo(latlng, { animate: true, duration: 1 });
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
      );
    }

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  return <div ref={mapRef} style={{ height: 280, width: '100%', zIndex: 0 }} />;
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTrip, setActiveTrip] = useState(undefined);
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const elapsed = useTimer(activeTrip?.start_time);
  useGpsTracking(activeTrip?.id ?? null);

  useEffect(() => {
    Promise.all([
      api.activeTrip().catch(() => null),
      api.myTrips().catch(() => []),
    ]).then(([active, trips]) => {
      setActiveTrip(active);
      setRecentTrips(trips.slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  const todayTrips = recentTrips.filter((t) => {
    const d = new Date(t.start_time);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const todayEarnings = todayTrips.reduce((sum, t) => sum + parseFloat(t.expense_amount || 0), 0);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e40af', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
        padding: '48px 20px 24px',
        color: '#fff',
      }}>
        <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 2 }}>{greeting},</p>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{firstName}</h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Active trip: live map + trip info bar */}
      {activeTrip && (
        <div>
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            <LivePositionMap />
            {/* Elapsed timer overlay */}
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 400,
              background: '#fff', borderRadius: 10, padding: '6px 14px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                {formatElapsed(elapsed)}
              </p>
            </div>
          </div>
          {/* Trip info bar */}
          <div style={{
            background: '#1e40af', padding: '14px 20px', color: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>
                Trip started at {fmtTime(activeTrip.start_time)}
              </p>
              <p style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeTrip.purpose || 'No purpose set'}
              </p>
              {activeTrip.vehicle_name && (
                <p style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{activeTrip.vehicle_name}</p>
              )}
            </div>
            <button
              onClick={() => navigate('/end-trip')}
              style={{
                background: '#fff', color: '#1e40af', borderRadius: 10,
                padding: '10px 20px', fontWeight: 700, fontSize: 14,
                flexShrink: 0, marginLeft: 12,
              }}
            >
              End Trip
            </button>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '16px 16px 0' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginBottom: 4 }}>Today's Trips</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: '#0f172a' }}>{todayTrips.length}</p>
        </div>
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginBottom: 4 }}>Today's Earnings</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Rs. </span>
            {todayEarnings.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Start trip CTA — only when no active trip */}
      {!activeTrip && (
        <div style={{ padding: '16px 16px 0' }}>
          <button
            onClick={() => navigate('/start-trip')}
            style={{
              width: '100%', padding: 20,
              background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
              color: '#fff', borderRadius: 20, fontSize: 17, fontWeight: 700, textAlign: 'left',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <div>
              <p style={{ fontSize: 13, opacity: 0.8, fontWeight: 400, marginBottom: 2 }}>Ready to go?</p>
              Start a New Trip
            </div>
            <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* Recent trips */}
      <div style={{ padding: '20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Recent Trips</h2>
          <button onClick={() => navigate('/history')} style={{ fontSize: 13, color: '#1e40af', fontWeight: 600 }}>
            See all
          </button>
        </div>

        {recentTrips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px', display: 'block' }}>
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <path d="M16 8h4l3 3v5h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            <p style={{ fontSize: 14 }}>No trips yet</p>
          </div>
        ) : (
          recentTrips.map((trip) => {
            const km = trip.manual_distance_km ?? trip.gps_distance_km;
            return (
              <div
                key={trip.id}
                onClick={() => navigate(`/history/${trip.id}`)}
                style={{
                  background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 8,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer',
                  display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
                }}
              >
                {/* Left */}
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', marginBottom: 2 }}>
                    {trip.purpose || 'Trip'}
                  </p>
                  <p style={{ fontSize: 12, color: '#94a3b8' }}>
                    {new Date(trip.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {trip.vehicle_name ? ` · ${trip.vehicle_name}` : ''}
                  </p>
                </div>

                {/* Center: km */}
                <div style={{ textAlign: 'center', padding: '0 12px' }}>
                  {km != null ? (
                    <>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#1e40af' }}>{parseFloat(km).toFixed(1)}</p>
                      <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>km</p>
                    </>
                  ) : <span />}
                </div>

                {/* Right */}
                <div style={{ textAlign: 'right' }}>
                  {statusBadge(trip.status)}
                  {trip.expense_amount > 0 && (
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                      Rs. {parseFloat(trip.expense_amount).toFixed(0)}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
