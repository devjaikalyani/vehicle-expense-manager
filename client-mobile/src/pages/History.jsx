import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

function statusBadge(status) {
  const isActive = status === 'active';
  return (
    <span style={{ background: isActive ? '#dbeafe' : '#f1f5f9', color: isActive ? '#1e40af' : '#64748b', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20 }}>
      {isActive ? 'Active' : 'Completed'}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 8, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 14, width: '70%', borderRadius: 6, background: '#e2e8f0' }} />
        <div style={{ height: 11, width: '45%', borderRadius: 6, background: '#f1f5f9' }} />
      </div>
      <div style={{ height: 14, width: 36, borderRadius: 6, background: '#e2e8f0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ height: 20, width: 60, borderRadius: 10, background: '#e2e8f0' }} />
        <div style={{ height: 14, width: 44, borderRadius: 6, background: '#f1f5f9' }} />
      </div>
    </div>
  );
}

export default function History() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.myTrips()
      .then(setTrips)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = trips.filter(t =>
    !search || (t.purpose || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)', padding: '48px 20px 20px', color: '#fff' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Trip History</h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>{trips.length} trips total</p>
      </div>

      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', borderRadius: 10, padding: '8px 12px', marginBottom: 10, border: '1.5px solid #e2e8f0' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by purpose..."
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#0f172a' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

      </div>

      <div style={{ padding: '16px 16px' }}>
        {loading ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}>
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <p style={{ fontSize: 15, fontWeight: 500 }}>{search || filter !== 'All' ? 'No matching trips' : 'No trips yet'}</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>{search ? `No trips matching "${search}"` : 'Your trips will appear here'}</p>
          </div>
        ) : (
          filtered.map((trip) => {
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
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', marginBottom: 2 }}>
                    {trip.purpose || 'Trip'}
                  </p>
                  <p style={{ fontSize: 12, color: '#94a3b8' }}>
                    {new Date(trip.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div style={{ textAlign: 'center', padding: '0 12px' }}>
                  {km != null ? (
                    <>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#1e40af' }}>{parseFloat(km).toFixed(1)}</p>
                      <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>km</p>
                    </>
                  ) : <span />}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {statusBadge(trip.status)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
