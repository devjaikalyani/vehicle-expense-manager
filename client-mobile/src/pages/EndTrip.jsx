import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { compressImage } from '../compress';
import { getCurrentPosition } from '../geolocation';
import OdometerScanner from '../components/OdometerScanner';

function DigitBoxes({ value, onChange }) {
  const inputs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  function handleChange(i, raw) {
    const d = raw.replace(/\D/g, '').slice(-1);
    const next = digits.map((c, idx) => (idx === i ? d : c));
    onChange(next.join(''));
    if (d && i < 5) inputs.current[i + 1]?.focus();
  }

  function handleKey(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = digits.map((c, idx) => (idx === i - 1 ? '' : c));
      onChange(next.join(''));
      inputs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted.padEnd(6, ' ').slice(0, 6).replace(/ /g, ''));
      inputs.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  }

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          style={{
            width: 44, height: 52, textAlign: 'center', fontSize: 20, fontWeight: 700,
            border: `2px solid ${d ? '#059669' : '#e2e8f0'}`,
            borderRadius: 10, outline: 'none', color: '#0f172a', background: '#fff',
            transition: 'border-color 0.15s',
          }}
        />
      ))}
    </div>
  );
}

export default function EndTrip() {
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [endOdometer, setEndOdometer] = useState('');
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fuelAmount, setFuelAmount] = useState('');
  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api.activeTrip().then(t => {
      if (!t) navigate('/', { replace: true });
      else setTrip(t);
    }).catch(() => navigate('/', { replace: true }));
  }, [navigate]);

  async function handleScanCapture(blob) {
    const compressed = await compressImage(blob);
    setPhoto(compressed);
    setPreview(URL.createObjectURL(compressed));
    setShowScanner(false);
  }

  async function handleGalleryPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPhoto(compressed);
    setPreview(URL.createObjectURL(compressed));
  }

  const distance = trip?.start_odometer != null && endOdometer
    ? Math.max(0, parseFloat(endOdometer) - parseFloat(trip.start_odometer))
    : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const pos = await getCurrentPosition();
      await api.endTrip(trip.id, {
        end_odometer: endOdometer ? parseFloat(endOdometer) : null,
        fuel_expense_amount: fuelAmount ? parseFloat(fuelAmount) : null,
        fuel_liters: fuelLiters ? parseFloat(fuelLiters) : null,
        fuel_type: fuelType || null,
        end_lat: pos?.lat ?? null,
        end_lng: pos?.lng ?? null,
      });
      if (photo) await api.uploadPhotos(trip.id, [photo]);
      setDone({ distance, purpose: trip.purpose, id: trip.id });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!trip) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 4px 20px rgba(5,150,105,0.35)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 8, textAlign: 'center' }}>Trip Ended</h1>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 28, textAlign: 'center' }}>
          {done.purpose || 'Trip'} has been submitted for review
        </p>

        {done.distance != null && (
          <div style={{ background: '#fff', borderRadius: 18, padding: '20px 32px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center', width: '100%' }}>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Distance Travelled</p>
            <p style={{ fontSize: 42, fontWeight: 800, color: '#1e40af', lineHeight: 1 }}>{done.distance.toFixed(1)}</p>
            <p style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>km</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            onClick={() => navigate(`/history/${done.id}`, { replace: true })}
            style={{ flex: 1, padding: '13px', border: '1.5px solid #1e40af', borderRadius: 14, fontSize: 14, fontWeight: 600, color: '#1e40af', background: '#fff', cursor: 'pointer' }}
          >
            View Trip
          </button>
          <button
            onClick={() => navigate('/', { replace: true })}
            style={{ flex: 1, padding: '13px', borderRadius: 14, fontSize: 14, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)', border: 'none', cursor: 'pointer' }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const fmtTime = d => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      {showScanner && (
        <OdometerScanner
          onCapture={handleScanCapture}
          onSkip={() => setShowScanner(false)}
          onBack={() => setShowScanner(false)}
        />
      )}

      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#f1f5f9' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
          padding: '48px 20px 20px',
          color: '#fff',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button onClick={() => navigate(-1)} style={{ color: '#fff', lineHeight: 1, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Conveyance Summary</h1>
            <p style={{ fontSize: 12, opacity: 0.75, marginTop: 2, marginBottom: 0 }}>{trip.purpose || 'No purpose'}</p>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {/* Odometer card — Punch In / Punch Out */}
          <div style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
              Odometer Readings
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {/* Punch In */}
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: 12 }}>
                <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>Punch In Reading</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
                  {trip.start_odometer != null ? parseFloat(trip.start_odometer).toLocaleString() : '--'}
                </p>
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>at {fmtTime(trip.start_time)}</p>
              </div>

              {/* Punch Out */}
              <div style={{ background: '#ecfdf5', borderRadius: 12, padding: 12 }}>
                <p style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginBottom: 6 }}>Punch Out Reading</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>
                  {endOdometer || '--'}
                </p>
                <p style={{ fontSize: 11, color: '#6ee7b7', marginTop: 2 }}>km</p>
              </div>
            </div>

            {/* Distance */}
            {distance != null ? (
              <div style={{ textAlign: 'center', padding: '14px 0', borderTop: '1px solid #f1f5f9' }}>
                <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Distance travelled today</p>
                <p style={{ fontSize: 40, fontWeight: 800, color: '#1e40af', lineHeight: 1 }}>{distance.toFixed(1)}</p>
                <p style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Km</p>
              </div>
            ) : (
              trip.start_odometer != null && (
                <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                  Enter end reading to calculate distance
                </p>
              )
            )}

            {distance != null && (
              <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 6 }}>
                Please update odometer reading if not correct
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            {/* End odometer entry card */}
            <div style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
                End Odometer Reading
              </p>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', textAlign: 'center', marginBottom: 16 }}>
                Please enter odometer reading.
              </p>

              {/* Photo thumbnails side by side */}
              {(trip.start_odometer != null || preview) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <div style={{ borderRadius: 10, overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0', minHeight: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, margin: '8px 0 4px' }}>Punch In Reading</p>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
                      {trip.start_odometer != null ? parseFloat(trip.start_odometer).toLocaleString() : '--'}
                    </p>
                  </div>
                  <div style={{ borderRadius: 10, overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0', position: 'relative', minHeight: 80 }}>
                    {preview ? (
                      <>
                        <img src={preview} alt="Odometer" style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: 80 }} />
                        <button
                          type="button"
                          onClick={() => { setPhoto(null); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                          style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 80, gap: 4 }}>
                        <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, margin: 0 }}>Punch Out Reading</p>
                        <p style={{ fontSize: 11, color: '#cbd5e1', margin: 0 }}>No photo</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <DigitBoxes value={endOdometer} onChange={setEndOdometer} />

              {/* Scanner button */}
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                style={{
                  width: '100%', marginTop: 16, padding: '12px', borderRadius: 12,
                  border: '1.5px solid #059669', background: '#ecfdf5',
                  color: '#059669', fontSize: 14, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  cursor: 'pointer',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                {preview ? 'Retake Odometer Photo' : 'Scan with Camera'}
              </button>

              <input ref={fileRef} type="file" accept="image/*" onChange={handleGalleryPhoto} style={{ display: 'none' }} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                Upload from gallery
              </button>
            </div>

            {/* Fuel expense */}
            <div style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                Fuel Expense (optional)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>Amount (Rs.)</label>
                  <input
                    type="number"
                    value={fuelAmount}
                    onChange={e => setFuelAmount(e.target.value)}
                    placeholder="0"
                    inputMode="decimal"
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 15, background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>Liters</label>
                  <input
                    type="number"
                    value={fuelLiters}
                    onChange={e => setFuelLiters(e.target.value)}
                    placeholder="0"
                    inputMode="decimal"
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 15, background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <select
                value={fuelType}
                onChange={e => setFuelType(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, background: '#f8fafc', outline: 'none', color: fuelType ? '#0f172a' : '#94a3b8' }}
              >
                <option value="">Fuel type (optional)</option>
                <option value="petrol">Petrol</option>
                <option value="diesel">Diesel</option>
                <option value="cng">CNG</option>
                <option value="electric">Electric</option>
              </select>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 12, color: '#dc2626', fontSize: 14 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '15px', borderRadius: 14, fontSize: 16, fontWeight: 700,
                background: loading ? '#6ee7b7' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                color: '#fff', boxShadow: loading ? 'none' : '0 4px 14px rgba(5,150,105,0.35)',
                border: 'none', cursor: loading ? 'default' : 'pointer',
              }}
            >
              {loading ? 'Submitting...' : 'Submit Trip'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
