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
  const isActive = status === 'active';
  return (
    <span style={{ background: isActive ? '#dbeafe' : '#f1f5f9', color: isActive ? '#1e40af' : '#64748b', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20 }}>
      {isActive ? 'Active' : 'Completed'}
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

function SideDrawer({ open, onClose, user, navigate, onLogout, allTrips = [], activeTrip }) {
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const now = new Date();

  const thisMonth = allTrips.filter(t => {
    const d = new Date(t.start_time);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthlyKm = thisMonth.reduce((s, t) => s + parseFloat(t.distance_km || 0), 0);

  const dow = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  startOfWeek.setHours(0, 0, 0, 0);
  const weekTrips = allTrips.filter(t => new Date(t.start_time) >= startOfWeek);
  const weeklyKm = weekTrips.reduce((s, t) => s + parseFloat(t.manual_distance_km ?? t.gps_distance_km ?? 0), 0);


  const [notifOn, setNotifOn] = useState(() => {
    if (!('Notification' in window)) return false;
    return Notification.permission === 'granted' && localStorage.getItem('notif_enabled') !== '0';
  });
  async function toggleNotif() {
    if (notifOn) {
      localStorage.setItem('notif_enabled', '0');
      setNotifOn(false);
    } else {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        localStorage.setItem('notif_enabled', '1');
        setNotifOn(true);
      }
    }
  }

  async function clearCache() {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    window.location.reload();
  }

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500 }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 280,
        background: '#fff', zIndex: 501, boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Profile card */}
        <div style={{ background: 'linear-gradient(135deg, #1e40af 0%, #6366f1 100%)', padding: '48px 20px 20px', color: '#fff' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: '#fff',
            border: '2px solid rgba(255,255,255,0.4)', marginBottom: 12,
          }}>
            {initials}
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{user?.name || 'User'}</p>
          {user?.employee_code && <p style={{ fontSize: 13, opacity: 0.75 }}>( {user.employee_code} )</p>}
          {user?.phone && <p style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>{user.phone}</p>}
        </div>

        {/* Monthly + Weekly stats */}
        <div style={{ padding: '14px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: '#f0f9ff', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ fontSize: 10, color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>This Month</p>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>{monthlyKm.toFixed(0)} km</p>
            <p style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>{thisMonth.length} trips</p>
          </div>
          <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ fontSize: 10, color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>This Week</p>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>{weeklyKm.toFixed(0)} km</p>
            <p style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>{weekTrips.length} trips</p>
          </div>
        </div>

        {/* Contextual trip action */}
        <div style={{ padding: '14px 16px 0' }}>
          <button
            onClick={() => { navigate(activeTrip ? '/end-trip' : '/start-trip'); onClose(); }}
            style={{
              width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: activeTrip ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #1e40af, #1d4ed8)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {activeTrip ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                End Current Trip
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Start New Trip
              </>
            )}
          </button>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: '12px 0 0' }}>
          <button
            onClick={() => { navigate('/history'); onClose(); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 15, fontWeight: 500, color: '#0f172a', textAlign: 'left',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span style={{ flex: 1 }}>Trip History</span>
          </button>
        </div>

        {/* Settings */}
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px 12px 4px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 8px 4px' }}>Settings</p>

          {'Notification' in window && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span style={{ fontSize: 14, color: '#0f172a', fontWeight: 500 }}>Notifications</span>
              </div>
              <button
                onClick={toggleNotif}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: notifOn ? '#22c55e' : '#e2e8f0', position: 'relative', flexShrink: 0,
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 2, left: notifOn ? 22 : 2,
                  transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <p style={{ fontSize: 14, color: '#0f172a', fontWeight: 500, marginBottom: 1 }}>App Info</p>
                <p style={{ fontSize: 11, color: '#94a3b8' }}>EVM Field v1.0.0</p>
              </div>
            </div>
            <button
              onClick={clearCache}
              style={{
                fontSize: 12, color: '#6366f1', fontWeight: 600,
                background: '#f5f3ff', border: 'none', borderRadius: 8,
                padding: '6px 12px', cursor: 'pointer',
              }}
            >
              Clear Cache
            </button>
          </div>
        </div>

        {/* Logout */}
        <div style={{ padding: '8px 12px' }}>
          <button
            onClick={onLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 20px', background: '#fef2f2', border: 'none', cursor: 'pointer',
              fontSize: 15, fontWeight: 500, color: '#dc2626', textAlign: 'left', borderRadius: 12,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>

        <div style={{ height: 16 }} />
      </div>
    </>
  );
}

export default function Home() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [activeTrip, setActiveTrip] = useState(undefined);
  const [recentTrips, setRecentTrips] = useState([]);
  const [allTrips, setAllTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleLogout() {
    await api.logout().catch(() => {});
    setUser(null);
    navigate('/login', { replace: true });
  }
  const elapsed = useTimer(activeTrip?.start_time);
  const liveKm = useGpsTracking(activeTrip?.id ?? null);

  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const [pullDist, setPullDist] = useState(0);

  async function loadData() {
    return Promise.all([
      api.activeTrip().catch(() => null),
      api.myTrips().catch(() => []),
    ]).then(([active, trips]) => {
      setActiveTrip(active);
      setAllTrips(trips);
      setRecentTrips(trips.slice(0, 5));
    });
  }

  function onTouchStart(e) {
    if (window.scrollY === 0) touchStartY.current = e.touches[0].clientY;
  }

  function onTouchMove(e) {
    if (!touchStartY.current) return;
    const dist = e.touches[0].clientY - touchStartY.current;
    if (dist > 0) setPullDist(Math.min(dist, 80));
  }

  async function onTouchEnd() {
    if (pullDist > 60 && !refreshing) {
      setRefreshing(true);
      await loadData();
      setRefreshing(false);
    }
    setPullDist(0);
    touchStartY.current = 0;
  }

  useEffect(() => { loadData().finally(() => setLoading(false)); }, []);

  const todayTrips = recentTrips.filter((t) => {
    const d = new Date(t.start_time);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const todayKm = todayTrips.reduce((sum, t) => sum + parseFloat(t.manual_distance_km ?? t.gps_distance_km ?? 0), 0);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)', padding: '48px 20px 24px', height: 120 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '16px 16px 0' }}>
          {[1,2].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ height: 12, width: '60%', borderRadius: 6, background: '#e2e8f0', marginBottom: 10 }} />
              <div style={{ height: 28, width: '40%', borderRadius: 6, background: '#f1f5f9' }} />
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 16px' }}>
          <div style={{ background: '#1e40af', borderRadius: 16, height: 72 }} />
        </div>
        <div style={{ padding: '0 16px' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 8, height: 64 }} />
          ))}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} navigate={navigate} onLogout={handleLogout} allTrips={allTrips} activeTrip={activeTrip} />
    <div
      style={{ maxWidth: 480, margin: '0 auto' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {(refreshing || pullDist > 20) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: `${Math.min(pullDist / 2, 20)}px 0 8px`,
          transition: refreshing ? 'none' : 'padding 0.1s',
        }}>
          <div style={{
            width: 24, height: 24, border: '2px solid #e2e8f0', borderTopColor: '#1e40af',
            borderRadius: '50%', animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
            transform: refreshing ? 'none' : `rotate(${pullDist * 4}deg)`,
          }} />
        </div>
      )}
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
        padding: '48px 20px 24px',
        color: '#fff',
        position: 'relative',
      }}>
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            position: 'absolute', top: 16, left: 16,
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
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
              {liveKm > 0 && (
                <p style={{ fontSize: 12, opacity: 0.9, marginTop: 2, fontWeight: 600 }}>
                  {liveKm.toFixed(2)} km tracked
                </p>
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
          <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginBottom: 4 }}>Today's Distance</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
            {todayKm.toFixed(1)}
            <span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8' }}> km</span>
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
          <button onClick={() => navigate('/dashboard')} style={{ fontSize: 13, color: '#1e40af', fontWeight: 600 }}>
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
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
    </>
  );
}
