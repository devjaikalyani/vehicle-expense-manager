import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_HEADERS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function statusDotColor(statuses) {
  if (statuses.includes('active')) return '#1e40af';
  return '#6366f1';
}

function statusBadge(status) {
  const isActive = status === 'active';
  return (
    <span style={{ background: isActive ? '#dbeafe' : '#f1f5f9', color: isActive ? '#1e40af' : '#64748b', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20 }}>
      {isActive ? 'Active' : 'Completed'}
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    api.myTrips().then(setTrips).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const monthTrips = trips.filter(t => {
    const d = new Date(t.start_time);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });

  const dayMap = {};
  monthTrips.forEach(t => {
    const day = new Date(t.start_time).getDate();
    if (!dayMap[day]) dayMap[day] = [];
    dayMap[day].push(t);
  });

  const activeCount  = monthTrips.filter(t => t.status === 'active').length;
  const monthlyKm    = monthTrips.reduce((s, t) => s + parseFloat(t.manual_distance_km ?? t.gps_distance_km ?? 0), 0);
  const monthlyTrips = monthTrips.length;

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  }

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const isToday = (day) =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();

  const selectedTrips = selectedDay ? (dayMap[selectedDay] || []) : [];

  const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const stats = [
    { count: monthlyTrips, label: 'Trips',   dotColor: '#6366f1' },
    { count: monthlyKm.toFixed(1), label: 'KM', dotColor: '#06b6d4' },
    { count: activeCount,  label: 'Active',  dotColor: '#1e40af' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e40af', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#f1f5f9' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
        padding: '48px 20px 20px',
        color: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Dashboard</h1>
        {user?.employee_code && (
          <span style={{ fontSize: 13, opacity: 0.7, fontWeight: 500 }}>( {user.employee_code} )</span>
        )}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Month card (blue gradient) */}
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
          borderRadius: 18, padding: 16, marginBottom: 16,
          boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
        }}>
          {/* Month navigator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button
              onClick={prevMonth}
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                {MONTHS[viewMonth]} {viewYear}
              </span>
            </div>
            <button
              onClick={nextMonth}
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Stats chips */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {stats.map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 2 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dotColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{s.count}</span>
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{s.label}</span>
              </div>
            ))}
          </div>

        </div>

        {/* Calendar */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '16px 12px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {DAY_HEADERS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94a3b8', padding: '4px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
            {/* Leading blank/prev-month cells */}
            {Array.from({ length: firstDayOfMonth }, (_, i) => (
              <div key={`prev-${i}`} style={{ textAlign: 'center', padding: '8px 2px' }}>
                <span style={{ fontSize: 13, color: '#e2e8f0' }}>{prevMonthDays - firstDayOfMonth + 1 + i}</span>
              </div>
            ))}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dayTrips = dayMap[day] || [];
              const hasDot = dayTrips.length > 0;
              const isSelected = selectedDay === day;
              const todayDay = isToday(day);
              const dotColor = hasDot ? statusDotColor(dayTrips.map(t => t.status)) : null;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  style={{
                    textAlign: 'center', padding: '6px 2px', cursor: hasDot ? 'pointer' : 'default',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                  }}
                >
                  <div style={{
                    width: 32, height: 32,
                    borderRadius: '50%',
                    background: isSelected ? '#1e40af' : todayDay ? '#eff6ff' : 'transparent',
                    border: todayDay && !isSelected ? '1.5px solid #1e40af' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{
                      fontSize: 13,
                      fontWeight: todayDay || isSelected ? 700 : 400,
                      color: isSelected ? '#fff' : todayDay ? '#1e40af' : '#0f172a',
                    }}>
                      {day}
                    </span>
                  </div>
                  {hasDot && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: isSelected ? '#fff' : dotColor, marginTop: 2 }} />
                  )}
                </div>
              );
            })}

            {/* Trailing next-month cells */}
            {(() => {
              const total = firstDayOfMonth + daysInMonth;
              const trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
              return Array.from({ length: trailing }, (_, i) => (
                <div key={`next-${i}`} style={{ textAlign: 'center', padding: '8px 2px' }}>
                  <span style={{ fontSize: 13, color: '#e2e8f0' }}>{i + 1}</span>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Monthly summary card */}
        <div style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h4l3-9 4 18 3-9h4" />
                </svg>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Monthly km</span>
              </div>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{monthlyKm.toFixed(1)}</p>
              <p style={{ fontSize: 11, color: '#94a3b8' }}>km this month</p>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13" rx="2" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Monthly Trips</span>
              </div>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{monthlyTrips}</p>
              <p style={{ fontSize: 11, color: '#94a3b8' }}>trips this month</p>
            </div>
          </div>
          {/* Month-over-month km comparison */}
          {(() => {
            const lm = viewMonth === 0 ? 11 : viewMonth - 1;
            const ly = viewMonth === 0 ? viewYear - 1 : viewYear;
            const lastMonthKm = trips
              .filter(t => { const d = new Date(t.start_time); return d.getFullYear() === ly && d.getMonth() === lm; })
              .reduce((s, t) => s + parseFloat(t.manual_distance_km ?? t.gps_distance_km ?? 0), 0);
            const diff = monthlyKm - lastMonthKm;
            if (lastMonthKm === 0 && monthlyKm === 0) return null;
            return (
              <div style={{ marginTop: 12, padding: '10px 14px', background: diff >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={diff >= 0 ? '#16a34a' : '#dc2626'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {diff >= 0
                    ? <polyline points="18 15 12 9 6 15" />
                    : <polyline points="6 9 12 15 18 9" />}
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: diff >= 0 ? '#16a34a' : '#dc2626' }}>
                  {Math.abs(diff).toFixed(1)} km {diff >= 0 ? 'more' : 'less'} than last month
                </span>
              </div>
            );
          })()}
        </div>

        {/* Last 7 days distance bar chart */}
        {(() => {
          const today = new Date();
          const barData = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() - (6 - i));
            const km = trips
              .filter(t => {
                const td = new Date(t.start_time);
                return td.getDate() === d.getDate() && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
              })
              .reduce((s, t) => s + parseFloat(t.manual_distance_km ?? t.gps_distance_km ?? 0), 0);
            const isToday = i === 6;
            return { label: d.toLocaleDateString('en-IN', { weekday: 'short' }), km, isToday };
          });
          const maxKm = Math.max(...barData.map(b => b.km), 1);
          const hasAny = barData.some(b => b.km > 0);
          if (!hasAny) return null;
          return (
            <div style={{ background: '#fff', borderRadius: 18, padding: '16px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Last 7 Days</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                {barData.map((b, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: '100%',
                      height: b.km > 0 ? Math.max((b.km / maxKm) * 56, 6) : 2,
                      background: b.isToday ? '#1e40af' : '#bfdbfe',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s',
                    }} />
                    <span style={{ fontSize: 9, color: b.isToday ? '#1e40af' : '#94a3b8', fontWeight: b.isToday ? 700 : 400 }}>{b.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>0 km</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{maxKm.toFixed(1)} km</span>
              </div>
            </div>
          );
        })()}

        {/* Selected day trips */}
        {selectedDay && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
              {selectedDay} {MONTHS[viewMonth]} — {selectedTrips.length} trip{selectedTrips.length !== 1 ? 's' : ''}
            </p>
            {selectedTrips.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                No trips on this day
              </div>
            ) : (
              selectedTrips.map((trip) => {
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
                        {fmtTime(trip.start_time)}
                        {trip.end_time ? ` – ${fmtTime(trip.end_time)}` : ''}
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
        )}

        {/* All trips for month (when no day selected) */}
        {!selectedDay && monthTrips.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
              All trips — {MONTHS[viewMonth]} {viewYear}
            </p>
            {monthTrips.map((trip) => {
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
                      {new Date(trip.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
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
            })}
          </div>
        )}

        {!selectedDay && monthTrips.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 18, padding: '40px 20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <p style={{ fontSize: 15, fontWeight: 500, color: '#94a3b8' }}>No trips in {MONTHS[viewMonth]}</p>
          </div>
        )}
      </div>
    </div>
  );
}
