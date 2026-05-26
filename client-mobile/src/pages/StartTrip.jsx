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
      onChange(pasted.padEnd(6, '').slice(0, 6).replace(/ /g, ''));
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
            border: `2px solid ${d ? '#1e40af' : '#e2e8f0'}`,
            borderRadius: 10, outline: 'none', color: '#0f172a', background: '#fff',
            transition: 'border-color 0.15s',
          }}
        />
      ))}
    </div>
  );
}

export default function StartTrip() {
  const navigate = useNavigate();
  const [purpose, setPurpose] = useState('');
  const [startOdometer, setStartOdometer] = useState('');
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [timeLimitExceeded, setTimeLimitExceeded] = useState(false);
  const [recentPurposes, setRecentPurposes] = useState([]);
  const [startAddress, setStartAddress] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setTimeLimitExceeded(true), 60000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    api.myTrips().then(trips => {
      const purposes = [...new Set(trips.map(t => t.purpose).filter(Boolean))].slice(0, 5);
      setRecentPurposes(purposes);
    }).catch(() => {});

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await r.json();
          const addr = data.address || {};
          const parts = [addr.suburb || addr.neighbourhood, addr.city || addr.town || addr.village, addr.state].filter(Boolean);
          if (parts.length) setStartAddress(parts.join(', '));
        } catch {}
      }, () => {}, { timeout: 8000 });
    }
  }, []);

  function handleScanCapture(file) {
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setShowScanner(false);
  }

  function handleScanSkip() {
    setShowScanner(false);
  }

  async function handleGalleryPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPhoto(compressed);
    setPreview(URL.createObjectURL(compressed));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const pos = await getCurrentPosition();
      let resolvedAddress = startAddress || null;
      if (!resolvedAddress && pos) {
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.lat}&lon=${pos.lng}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await r.json();
          const addr = data.address || {};
          const parts = [addr.suburb || addr.neighbourhood, addr.city || addr.town || addr.village, addr.state].filter(Boolean);
          if (parts.length) resolvedAddress = parts.join(', ');
        } catch {}
      }
      const trip = await api.startTrip({
        purpose: purpose.trim() || null,
        start_odometer: startOdometer ? parseFloat(startOdometer) : null,
        start_lat: pos?.lat ?? null,
        start_lng: pos?.lng ?? null,
        start_address: resolvedAddress,
      });
      if (photo) await api.uploadPhotos(trip.id, [photo]);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle = {
    width: '100%', padding: '13px 0', fontSize: 15,
    border: 'none', outline: 'none', background: 'transparent',
    color: '#0f172a', boxSizing: 'border-box',
  };

  return (
    <>
      {timeLimitExceeded && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '28px 24px', maxWidth: 320, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>Time Limit Exceeded</h3>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px', lineHeight: 1.5 }}>
              1 minute time limit has exceeded for submission.
            </p>
            <button
              onClick={() => navigate('/', { replace: true })}
              style={{ width: '100%', padding: '13px', borderRadius: 12, background: '#1e40af', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showScanner && (
        <OdometerScanner
          onCapture={handleScanCapture}
          onSkip={handleScanSkip}
          onBack={() => setShowScanner(false)}
        />
      )}

      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#f1f5f9' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
          padding: '48px 20px 24px',
          color: '#fff',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button onClick={() => navigate(-1)} style={{ color: '#fff', lineHeight: 1, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Start Trip</h1>
            <p style={{ fontSize: 12, opacity: 0.7, marginTop: 2, marginBottom: 0 }}>Fill in the details below</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 16 }}>
          {/* Purpose card */}
          <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '4px 16px 14px' }}>
              {startAddress ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f0fdf4', borderRadius: 10, marginTop: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span style={{ fontSize: 13, color: '#15803d', fontWeight: 500 }}>{startAddress}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, marginTop: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>Getting location...</span>
                </div>
              )}
            </div>

            <div style={{ height: 1, background: '#f1f5f9', margin: '0 16px' }} />

            <div style={{ padding: '4px 16px 0' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 14 }}>
                Purpose
              </label>
              <input
                type="text"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="e.g. Client visit, Delivery"
                style={{ ...fieldStyle, paddingBottom: recentPurposes.length > 0 ? 0 : 14 }}
              />
              {recentPurposes.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, paddingBottom: 14 }}>
                  {recentPurposes.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPurpose(p)}
                      style={{
                        padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${purpose === p ? '#1e40af' : '#e2e8f0'}`,
                        background: purpose === p ? '#eff6ff' : '#f8fafc',
                        color: purpose === p ? '#1e40af' : '#64748b',
                        fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Odometer card */}
          <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20, marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 16px' }}>
              Odometer Reading
            </p>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', textAlign: 'center', margin: '0 0 18px' }}>
              Please enter odometer reading.
            </p>

            {/* Photo thumbnail if captured */}
            {preview && (
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <img src={preview} alt="Odometer" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 12 }} />
                <button
                  type="button"
                  onClick={() => { setPhoto(null); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                  style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            <DigitBoxes value={startOdometer} onChange={setStartOdometer} />

            {/* Scan button */}
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              style={{
                width: '100%', marginTop: 16, padding: '12px', borderRadius: 12,
                border: '1.5px solid #1e40af', background: '#eff6ff',
                color: '#1e40af', fontSize: 14, fontWeight: 600,
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

            {/* Gallery fallback */}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleGalleryPhoto} style={{ display: 'none' }} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              Upload from gallery
            </button>
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
              background: loading ? '#93c5fd' : 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
              color: '#fff', boxShadow: loading ? 'none' : '0 4px 14px rgba(30,64,175,0.35)',
              border: 'none', cursor: loading ? 'default' : 'pointer',
            }}
          >
            {loading ? 'Getting location...' : 'Start Trip'}
          </button>
        </form>
      </div>
    </>
  );
}
