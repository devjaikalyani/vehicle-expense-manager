import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

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

export default function History() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.myTrips()
      .then(setTrips)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
        padding: '48px 20px 20px',
        color: '#fff',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Trip History</h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>{trips.length} trips</p>
      </div>

      <div style={{ padding: '16px 16px' }}>
        {trips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p style={{ fontSize: 15, fontWeight: 500 }}>No trips yet</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Your trips will appear here</p>
          </div>
        ) : (
          trips.map((trip) => {
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
                    {new Date(trip.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {trip.vehicle_name && (
                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{trip.vehicle_name}</p>
                  )}
                </div>

                {/* Center */}
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
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 6 }}>
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
