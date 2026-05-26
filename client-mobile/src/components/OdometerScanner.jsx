import { useRef, useState } from 'react';
import { compressImage } from '../compress';

export default function OdometerScanner({ onCapture, onSkip, onBack }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [rawFile, setRawFile] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipReason, setSkipReason] = useState('');

  function openCamera() {
    inputRef.current?.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawFile(file);
    setPreview(URL.createObjectURL(file));
    // Reset input so the same file can be re-selected after retake
    e.target.value = '';
  }

  function handleRetake() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setRawFile(null);
    openCamera();
  }

  async function handleUsePhoto() {
    if (!rawFile) return;
    setCompressing(true);
    try {
      const compressed = await compressImage(rawFile, { maxPx: 1920, quality: 0.88 });
      onCapture(compressed);
    } finally {
      setCompressing(false);
    }
  }

  function handleSkip() {
    onSkip(skipReason.trim());
  }

  function handleBack() {
    if (preview) URL.revokeObjectURL(preview);
    onBack();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200 }}>
      {/* Hidden native camera input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* ── CONFIRMATION SCREEN ── */}
      {preview ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Photo fills screen */}
          <img
            src={preview}
            alt="odometer"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
          />

          {/* Top label */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '48px 16px 16px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
            textAlign: 'center',
          }}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 17, margin: 0 }}>Is this photo clear?</p>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: '4px 0 0' }}>
              Make sure the odometer digits are readable
            </p>
          </div>

          {/* Bottom confirm buttons */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '16px 24px 48px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
            display: 'flex', gap: 16,
          }}>
            {/* Retake */}
            <button
              onClick={handleRetake}
              disabled={compressing}
              style={{
                flex: 1, padding: '14px', borderRadius: 14,
                background: 'rgba(255,255,255,0.15)',
                border: '2px solid rgba(255,255,255,0.5)',
                color: '#fff', fontSize: 15, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: compressing ? 'default' : 'pointer',
                opacity: compressing ? 0.5 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Retake
            </button>

            {/* Use Photo */}
            <button
              onClick={handleUsePhoto}
              disabled={compressing}
              style={{
                flex: 1, padding: '14px', borderRadius: 14,
                background: compressing ? '#059669aa' : '#059669',
                border: 'none',
                color: '#fff', fontSize: 15, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: compressing ? 'default' : 'pointer',
              }}
            >
              {compressing ? (
                <>
                  <div style={{
                    width: 18, height: 18,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid #fff',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  Saving...
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Use Photo
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* ── CAMERA LAUNCH SCREEN ── */
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '48px 16px 12px',
          }}>
            <button
              onClick={handleBack}
              style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 17, margin: 0 }}>Scan Odometer</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '3px 0 0' }}>Take a clear photo of the odometer</p>
            </div>
            <div style={{ width: 40 }} />
          </div>

          {/* Center area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 32px' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
              Point your camera at the odometer and take a clear, well-lit photo
            </p>
          </div>

          {/* Bottom controls */}
          <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <button
              onClick={openCamera}
              style={{
                width: '100%', padding: '16px', borderRadius: 14,
                background: '#1e40af', color: '#fff',
                fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Open Camera
            </button>
            <button
              onClick={() => setShowSkipModal(true)}
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: 600, padding: '8px 24px', border: 'none', cursor: 'pointer' }}
            >
              Skip today's reading &raquo;
            </button>
          </div>
        </div>
      )}

      {/* Skip modal */}
      {showSkipModal && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 20 }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 24px 40px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>Not travelling today?</h3>
              <button
                onClick={() => setShowSkipModal(false)}
                style={{ width: 28, height: 28, borderRadius: 6, border: '1.5px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                x
              </button>
            </div>
            <textarea
              value={skipReason}
              onChange={e => setSkipReason(e.target.value)}
              placeholder="Reason*"
              rows={3}
              style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, background: '#f8fafc', outline: 'none', resize: 'none', boxSizing: 'border-box', color: '#0f172a' }}
            />
            <button
              onClick={handleSkip}
              disabled={!skipReason.trim()}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, marginTop: 12, border: 'none',
                background: skipReason.trim() ? '#1e40af' : '#e2e8f0',
                color: skipReason.trim() ? '#fff' : '#94a3b8',
                fontSize: 15, fontWeight: 700, cursor: skipReason.trim() ? 'pointer' : 'default',
              }}
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
