import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STEPS = [
  {
    id: 'welcome',
    title: 'EVM Field makes your work easier',
    body: 'Track your trips and total distance travelled. Let us set a few things up for you.',
    action: null,
  },
  {
    id: 'location',
    title: 'Location permission',
    body: 'We need your location to capture where trips start and end, and to track your route accurately.',
    hint: 'Select "While using the app" or "Allow" when the browser asks.',
    action: 'location',
    actionLabel: 'Grant location access',
  },
  {
    id: 'battery',
    title: 'Allow background access',
    titleHi: 'पृष्ठभूमि में चलाने की अनुमति दें',
    body: 'To track your trip without interruption, allow EVM Field to run without battery restrictions.',
    bodyHi: 'यात्रा ट्रैक करते समय ऐप बंद न हो, इसलिए बैटरी प्रतिबंध हटाएं।',
    steps: [
      'Open Settings  →  search "Battery"  →  disable Power Saving Mode',
      'Long press EVM Field app  →  App Info  →  Battery Usage  →  select Unrestricted',
    ],
    stepsHi: [
      'सेटिंग्स खोलें → "Battery" खोजें → Power Saving Mode बंद करें',
      'EVM Field ऐप को देर तक दबाएं → App Info → Battery Usage → Unrestricted चुनें',
    ],
    action: null,
  },
  {
    id: 'screenshots',
    title: 'Upload proof screenshots',
    titleHi: 'बैटरी सेटिंग्स का स्क्रीनशॉट अपलोड करें',
    body: 'Take a screenshot of your battery settings and upload it here so your manager knows the app is set up correctly.',
    bodyHi: 'बैटरी सेटिंग्स का स्क्रीनशॉट लेकर यहाँ अपलोड करें, ताकि मैनेजर को पता चले कि ऐप सही तरह से सेट है।',
    action: 'screenshots',
    actionLabel: 'Upload Screenshots',
  },
  {
    id: 'notification',
    title: 'Stay notified',
    body: 'Receive updates when your manager leaves feedback on your trips.',
    action: 'notification',
    actionLabel: 'Enable notifications',
  },
  {
    id: 'verify',
    title: 'Is EVM Field working properly?',
    body: 'While you are on a trip, you will see a notification like this. If you see it, EVM Field is running correctly in the background.',
    action: null,
  },
  {
    id: 'finish',
    title: 'Setup finished',
    body: 'You are all set. EVM Field is ready to track your trips and distance.',
    action: null,
  },
];

/* ---- Illustrations ---- */

function IllustrationWelcome() {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="80" fill="#eff6ff" />
      <circle cx="60" cy="75" r="18" fill="#1e40af" />
      <circle cx="60" cy="75" r="9" fill="#fff" />
      <circle cx="140" cy="125" r="18" fill="#059669" />
      <circle cx="140" cy="125" r="9" fill="#fff" />
      <path d="M60 75 Q80 60 100 100 Q120 140 140 125" stroke="#1e40af" strokeWidth="3" strokeDasharray="8 5" fill="none" strokeLinecap="round" />
      <rect x="82" y="90" width="36" height="22" rx="5" fill="#fff" stroke="#1e40af" strokeWidth="2" />
      <rect x="88" y="112" width="24" height="4" rx="2" fill="#1e40af" />
      <circle cx="100" cy="101" r="5" fill="#1e40af" />
    </svg>
  );
}

function IllustrationLocation() {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="80" fill="#eff6ff" />
      <circle cx="100" cy="100" r="56" stroke="#bfdbfe" strokeWidth="2" strokeDasharray="6 4" />
      <circle cx="100" cy="100" r="36" stroke="#93c5fd" strokeWidth="2" strokeDasharray="6 4" />
      <path d="M100 65 C88 65 78 75 78 87 C78 103 100 127 100 127 C100 127 122 103 122 87 C122 75 112 65 100 65Z" fill="#1e40af" />
      <circle cx="100" cy="87" r="9" fill="#fff" />
    </svg>
  );
}

function IllustrationBattery() {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="80" fill="#eff6ff" />
      <rect x="65" y="50" width="70" height="110" rx="12" fill="#fff" stroke="#1e40af" strokeWidth="2.5" />
      <rect x="73" y="62" width="54" height="75" rx="6" fill="#eff6ff" />
      <circle cx="100" cy="148" r="4" fill="#1e40af" />
      <rect x="82" y="74" width="36" height="18" rx="4" fill="#fff" stroke="#1e40af" strokeWidth="2" />
      <rect x="118" y="79" width="4" height="8" rx="2" fill="#1e40af" />
      <rect x="84" y="76" width="22" height="14" rx="2" fill="#059669" />
      <circle cx="136" cy="68" r="14" fill="#059669" />
      <path d="M130 68 L134 72 L142 62" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="78" y="105" width="44" height="5" rx="2.5" fill="#bfdbfe" />
      <rect x="78" y="115" width="30" height="5" rx="2.5" fill="#bfdbfe" />
    </svg>
  );
}

function IllustrationNotification() {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="80" fill="#eff6ff" />
      <path d="M100 55 C83 55 70 68 70 85 L70 110 L58 122 L142 122 L130 110 L130 85 C130 68 117 55 100 55Z" fill="#1e40af" />
      <rect x="88" y="122" width="24" height="12" rx="6" fill="#1e40af" />
      <circle cx="100" cy="55" r="7" fill="#fff" stroke="#1e40af" strokeWidth="2" />
      <circle cx="136" cy="68" r="12" fill="#059669" />
      <path d="M131 68 L134 71 L141 64" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IllustrationFor({ id }) {
  if (id === 'location') return <IllustrationLocation />;
  if (id === 'battery') return <IllustrationBattery />;
  if (id === 'notification') return <IllustrationNotification />;
  return <IllustrationWelcome />;
}

/* ---- Verify step ---- */

function VerifyStep() {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ border: '2px solid #059669', borderRadius: 16, padding: 16, background: '#f0fdf4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>EVM Field  •  now</p>
            <p style={{ fontSize: 12, color: '#475569', margin: '2px 0 0' }}>Status: Trip in progress</p>
            <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Running in background</p>
          </div>
        </div>
        <div style={{ background: '#059669', borderRadius: 8, padding: '8px 12px' }}>
          <p style={{ fontSize: 12, color: '#fff', fontWeight: 600, margin: 0 }}>
            This notification will be shown while you are on a trip
          </p>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginTop: 14, textAlign: 'center' }}>
        If you do not see this notification during a trip, EVM Field may not be tracking properly.
      </p>
    </div>
  );
}

/* ---- Setup Finished step ---- */

function FinishStep() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 20 }}>
      <div style={{
        width: 88, height: 88, borderRadius: '50%',
        background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 28px rgba(30,64,175,0.35)',
        marginBottom: 28,
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '0 0 12px', textAlign: 'center' }}>Setup finished</h1>
      <p style={{ fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
        You are all set. EVM Field is ready to track your trips and distance.
      </p>
    </div>
  );
}

/* ---- Screenshots upload step ---- */

function ScreenshotsStep({ files, onFiles }) {
  const inputRef = useRef(null);

  function handleChange(e) {
    const selected = Array.from(e.target.files || []);
    if (selected.length) onFiles(prev => [...prev, ...selected]);
  }

  function removeFile(i) {
    onFiles(prev => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ marginTop: 16 }}>
      {files.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {files.map((f, i) => (
            <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '9/16', background: '#f8fafc' }}>
              <img src={URL.createObjectURL(f)} alt="Screenshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                onClick={() => removeFile(i)}
                style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                x
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleChange} style={{ display: 'none' }} />
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%', padding: '14px', borderRadius: 14, border: '2px dashed #cbd5e1',
          background: '#f8fafc', color: '#475569', fontSize: 14, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: 'pointer',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 16 12 12 8 16" />
          <line x1="12" y1="12" x2="12" y2="21" />
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
        </svg>
        Upload Screenshots
      </button>
    </div>
  );
}

/* ---- Main component ---- */

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [permDone, setPermDone] = useState({});
  const [permLoading, setPermLoading] = useState(false);
  const [screenshotFiles, setScreenshotFiles] = useState([]);

  const current = STEPS[step];
  const isFinish = current.id === 'finish';
  const isVerify = current.id === 'verify';
  const isScreenshots = current.id === 'screenshots';

  const isDone = isFinish || isVerify || isScreenshots || !current.action || !!permDone[current.action];

  async function handleGrantPermission() {
    setPermLoading(true);
    try {
      if (current.action === 'location') {
        await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 })
        ).catch(() => {});
        setPermDone(prev => ({ ...prev, location: true }));
      } else if (current.action === 'notification') {
        if ('Notification' in window) {
          await Notification.requestPermission().catch(() => {});
        }
        setPermDone(prev => ({ ...prev, notification: true }));
      }
    } finally {
      setPermLoading(false);
    }
  }

  function advance() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      localStorage.setItem('evm_onboarded', '1');
      navigate('/', { replace: true });
    }
  }

  function skip() {
    localStorage.setItem('evm_onboarded', '1');
    navigate('/', { replace: true });
  }

  /* Finish step gets its own full-screen layout */
  if (isFinish) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #f0f4ff 0%, #faf5ff 60%, #fff 100%)', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', padding: '0 32px 64px' }}>
        <FinishStep />
        <button
          onClick={advance}
          style={{
            width: 64, height: 64, borderRadius: '50%', border: 'none',
            background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(30,64,175,0.4)',
            alignSelf: 'flex-end', cursor: 'pointer',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      {/* Progress bar */}
      <div style={{ height: 4, background: '#e2e8f0', flexShrink: 0 }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, #1e40af, #7c3aed)',
          width: `${((step + 1) / STEPS.length) * 100}%`,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Skip button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px 0', flexShrink: 0 }}>
        {step < STEPS.length - 1 && (
          <button onClick={skip} style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
            Skip
          </button>
        )}
      </div>

      {/* Illustration — hidden for verify/screenshots steps */}
      {!isVerify && !isScreenshots && (
        <div style={{ flex: isVerify || isScreenshots ? 0 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 32px' }}>
          <IllustrationFor id={current.id} />
        </div>
      )}

      {/* Text + actions */}
      <div style={{ padding: '0 32px 48px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 2, lineHeight: 1.25 }}>
          {current.title}
        </h1>
        {current.titleHi && (
          <p style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 12, marginTop: 0 }}>
            {current.titleHi}
          </p>
        )}
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.65, marginBottom: 0 }}>
          {current.body}
        </p>
        {current.bodyHi && (
          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginTop: 4, fontStyle: 'italic' }}>
            {current.bodyHi}
          </p>
        )}

        {/* Battery steps */}
        {current.steps && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {current.steps.map((s, i) => (
              <div key={i} style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 14px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ minWidth: 22, height: 22, borderRadius: '50%', background: '#1e40af', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {i + 1}
                  </span>
                  <div>
                    <p style={{ fontSize: 13, color: '#0f172a', fontWeight: 500, lineHeight: 1.5, margin: 0 }}>{s}</p>
                    <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', lineHeight: 1.4, margin: '3px 0 0' }}>{current.stepsHi[i]}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {current.hint && (
          <p style={{ fontSize: 13, color: '#1e40af', fontWeight: 600, marginTop: 10 }}>
            {current.hint}
          </p>
        )}

        {/* Verify notification mock */}
        {isVerify && <VerifyStep />}

        {/* Screenshots upload */}
        {isScreenshots && (
          <ScreenshotsStep files={screenshotFiles} onFiles={setScreenshotFiles} />
        )}

        {/* Permission grant button */}
        {current.action && current.action !== 'screenshots' && !permDone[current.action] && (
          <button
            onClick={handleGrantPermission}
            disabled={permLoading}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, fontSize: 15, fontWeight: 700, border: 'none',
              background: permLoading ? '#93c5fd' : 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
              color: '#fff', marginTop: 28,
              boxShadow: permLoading ? 'none' : '0 4px 14px rgba(30,64,175,0.35)',
              cursor: permLoading ? 'default' : 'pointer',
            }}
          >
            {permLoading ? 'Requesting...' : current.actionLabel}
          </button>
        )}

        {/* Granted state */}
        {current.action && current.action !== 'screenshots' && permDone[current.action] && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 28, padding: '12px 16px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span style={{ fontSize: 14, color: '#16a34a', fontWeight: 600 }}>Permission granted</span>
          </div>
        )}

        {/* Dots + next button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 36 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {STEPS.filter(s => s.id !== 'finish').map((_, i) => (
              <div
                key={i}
                style={{
                  height: 8, borderRadius: 4,
                  width: i === step ? 24 : 8,
                  background: i === step ? '#1e40af' : '#e2e8f0',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>

          <button
            onClick={advance}
            disabled={!isDone}
            style={{
              width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: isDone ? 'pointer' : 'default',
              background: isDone ? 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)' : '#e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isDone ? '0 4px 14px rgba(30,64,175,0.4)' : 'none',
              transition: 'all 0.3s ease',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isDone ? '#fff' : '#94a3b8'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
