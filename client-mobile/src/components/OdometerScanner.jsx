import { useEffect, useRef, useState } from 'react';

export default function OdometerScanner({ onCapture, onSkip, onBack }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState('');
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipReason, setSkipReason] = useState('');

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (!cancelled) setReady(true);
          };
        }
      })
      .catch(() => {
        if (!cancelled) setCamError('Camera not available. Please use manual entry.');
      });

    return () => {
      cancelled = true;
      stopStream();
    };
  }, []);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    stopStream();
    canvas.toBlob(blob => onCapture(blob), 'image/jpeg', 0.9);
  }

  function handleSkip() {
    stopStream();
    onSkip(skipReason.trim());
  }

  function handleBack() {
    stopStream();
    onBack();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '48px 16px 12px' }}>
        <button
          onClick={handleBack}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 17, margin: 0 }}>Scan Odometer</p>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, margin: '3px 0 0' }}>Align the digits inside the frame</p>
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* Camera feed */}
      {camError ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#fff', fontSize: 15, marginBottom: 20 }}>{camError}</p>
            <button
              onClick={() => onSkip('')}
              style={{ background: '#1e40af', color: '#fff', padding: '12px 28px', borderRadius: 12, fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              Enter manually
            </button>
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {/* Corner bracket frame overlay */}
      {!camError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ position: 'relative', width: '82%', height: 110 }}>
            <span style={{ position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTop: '3px solid #fff', borderLeft: '3px solid #fff' }} />
            <span style={{ position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTop: '3px solid #fff', borderRight: '3px solid #fff' }} />
            <span style={{ position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottom: '3px solid #fff', borderLeft: '3px solid #fff' }} />
            <span style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottom: '3px solid #fff', borderRight: '3px solid #fff' }} />
          </div>
        </div>
      )}

      {/* Bottom controls */}
      {!camError && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingBottom: 48 }}>
          {/* Shutter button */}
          <button
            onClick={capture}
            disabled={!ready}
            style={{
              width: 72, height: 72, borderRadius: '50%',
              border: '4px solid rgba(255,255,255,0.5)',
              background: ready ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
              cursor: ready ? 'pointer' : 'default',
            }}
          />
          {/* Skip */}
          <button
            onClick={() => setShowSkipModal(true)}
            style={{ background: 'rgba(30,64,175,0.85)', color: '#fff', fontSize: 14, fontWeight: 600, padding: '10px 28px', borderRadius: 24, border: 'none', cursor: 'pointer' }}
          >
            Skip today's reading &raquo;
          </button>
        </div>
      )}

      {/* Skip / Not travelling modal */}
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
