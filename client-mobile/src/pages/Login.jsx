import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';

export default function Login() {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [view, setView] = useState('login');
  const [otpMode, setOtpMode] = useState('forgot');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [setupName, setSetupName] = useState('');
  const [otpMsg, setOtpMsg] = useState(null);
  const [otpLoading, setOtpLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user } = await api.login(email, password);
      setUser(user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openOtp(mode) {
    setOtpMode(mode);
    setOtpEmail('');
    setOtpCode('');
    setResetToken('');
    setNewPw('');
    setConfirmPw('');
    setSetupName('');
    setOtpMsg(null);
    setView('otp-email');
  }

  async function sendOtp(e) {
    e.preventDefault();
    setOtpMsg(null);
    setOtpLoading(true);
    try {
      await api.sendOtp(otpEmail);
      setOtpMsg({ type: 'success', text: `OTP sent to ${otpEmail}. Check your inbox.` });
      setTimeout(() => { setOtpMsg(null); setView('otp-verify'); }, 1200);
    } catch (err) {
      setOtpMsg({ type: 'error', text: err.message || 'Failed to send OTP.' });
    } finally {
      setOtpLoading(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setOtpMsg(null);
    setOtpLoading(true);
    try {
      const res = await api.verifyOtp(otpEmail, otpCode, otpMode);
      setResetToken(res.resetToken);
      setOtpMsg({ type: 'success', text: 'OTP verified.' });
      setTimeout(() => { setOtpMsg(null); setView('otp-password'); }, 800);
    } catch (err) {
      setOtpMsg({ type: 'error', text: err.message || 'Invalid OTP.' });
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setOtpMsg(null);
    if (newPw !== confirmPw) { setOtpMsg({ type: 'error', text: 'Passwords do not match.' }); return; }
    setOtpLoading(true);
    try {
      await api.resetPassword(resetToken, newPw, setupName);
      setOtpMsg({ type: 'success', text: 'Password set successfully! You can now sign in.' });
      setTimeout(() => { setView('login'); setOtpMsg(null); }, 2000);
    } catch (err) {
      setOtpMsg({ type: 'error', text: err.message || 'Failed to reset password.' });
    } finally {
      setOtpLoading(false);
    }
  }

  const modeLabel = otpMode === 'forgot' ? 'Forgot Password' : 'Set Up Account';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 50%, #2563eb 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      {/* Brand */}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, background: 'rgba(255,255,255,0.2)', borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2" />
            <path d="M16 8h4l3 3v5h-7V8z" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
        </div>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>VEM Field</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>Vehicle Expense Manager</p>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 400, background: '#fff',
        borderRadius: 20, padding: '24px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>

        {/* LOGIN VIEW */}
        {view === 'login' && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>Sign In</h2>
            {error && <AlertBox type="error" text={error} />}
            <form onSubmit={handleLogin}>
              <Field label="Email Address">
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required autoComplete="email" placeholder="you@company.com"
                  style={inputStyle}
                />
              </Field>
              <Field label="Password" style={{ marginBottom: 20 }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    required autoComplete="current-password" placeholder="Enter your password"
                    style={{ ...inputStyle, paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={eyeBtnStyle}>
                    {showPw ? <EyeOff /> : <EyeOn />}
                  </button>
                </div>
              </Field>
              <SubmitBtn loading={loading} label="Sign In" loadingLabel="Signing in..." />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                <LinkBtn onClick={() => openOtp('forgot')}>Forgot Password</LinkBtn>
                <LinkBtn onClick={() => openOtp('setup')}>Set Up Account</LinkBtn>
              </div>
            </form>
          </>
        )}

        {/* SEND OTP VIEW */}
        {view === 'otp-email' && (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>{modeLabel}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                {otpMode === 'forgot' ? 'We will send a 6-digit code to your email.' : 'Enter your company email to activate your account.'}
              </div>
            </div>
            {otpMsg && <AlertBox type={otpMsg.type} text={otpMsg.text} />}
            <form onSubmit={sendOtp}>
              <Field label="Email Address">
                <input
                  type="email" value={otpEmail} onChange={e => setOtpEmail(e.target.value)}
                  placeholder="you@company.com" required autoFocus style={inputStyle}
                />
              </Field>
              <SubmitBtn loading={otpLoading} label="Send OTP" loadingLabel="Sending..." />
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <LinkBtn onClick={() => setView('login')}>Back to Sign In</LinkBtn>
              </div>
            </form>
          </>
        )}

        {/* VERIFY OTP VIEW */}
        {view === 'otp-verify' && (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>Enter Verification Code</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                A 6-digit code was sent to <strong>{otpEmail}</strong>
              </div>
            </div>
            {otpMsg && <AlertBox type={otpMsg.type} text={otpMsg.text} />}
            <form onSubmit={verifyOtp}>
              <Field label="OTP Code">
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code" required autoFocus
                  style={{ ...inputStyle, fontSize: 24, fontWeight: 700, letterSpacing: '0.2em', textAlign: 'center' }}
                />
              </Field>
              <SubmitBtn loading={otpLoading || otpCode.length !== 6} label="Verify Code" loadingLabel="Verifying..." />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                <LinkBtn onClick={() => setView('otp-email')}>Back</LinkBtn>
                <LinkBtn onClick={sendOtp} disabled={otpLoading}>Resend OTP</LinkBtn>
              </div>
            </form>
          </>
        )}

        {/* SET NEW PASSWORD VIEW */}
        {view === 'otp-password' && (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>
                {otpMode === 'forgot' ? 'Reset Password' : 'Create Your Account'}
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                {otpMode === 'setup' ? 'Enter your name and set a password.' : 'Choose a strong password for your account.'}
              </div>
            </div>
            {otpMsg && <AlertBox type={otpMsg.type} text={otpMsg.text} />}
            <form onSubmit={handleResetPassword}>
              {otpMode === 'setup' && (
                <Field label="Full Name">
                  <input
                    type="text" value={setupName} onChange={e => setSetupName(e.target.value)}
                    placeholder="e.g. Rahul Sharma" required autoFocus style={inputStyle}
                  />
                </Field>
              )}
              <Field label="New Password">
                <input
                  type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                  placeholder="Min. 6 characters" minLength={6} required style={inputStyle}
                />
              </Field>
              <Field label="Confirm Password" style={{ marginBottom: 20 }}>
                <input
                  type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat new password" required style={inputStyle}
                />
              </Field>
              <SubmitBtn
                loading={otpLoading}
                label={otpMode === 'forgot' ? 'Reset Password' : 'Create Password'}
                loadingLabel="Saving..."
              />
            </form>
          </>
        )}
      </div>

      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 20 }}>
        Contact your manager if you need access
      </p>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SubmitBtn({ loading, label, loadingLabel }) {
  return (
    <button type="submit" disabled={loading} style={{
      width: '100%', padding: '13px', borderRadius: 12, fontSize: 15, fontWeight: 700,
      background: loading ? '#93c5fd' : '#1e40af', color: '#fff',
      cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
    }}>
      {loading ? loadingLabel : label}
    </button>
  );
}

function LinkBtn({ onClick, children, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      background: 'none', border: 'none', color: '#1e40af', fontSize: 13,
      fontWeight: 600, cursor: 'pointer', padding: '4px 0',
    }}>
      {children}
    </button>
  );
}

function AlertBox({ type, text }) {
  const isError = type === 'error';
  return (
    <div style={{
      background: isError ? '#fef2f2' : '#f0fdf4',
      border: `1px solid ${isError ? '#fecaca' : '#bbf7d0'}`,
      borderRadius: 10, padding: '10px 14px', marginBottom: 14,
      color: isError ? '#dc2626' : '#16a34a', fontSize: 13,
    }}>
      {text}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0',
  borderRadius: 10, fontSize: 15, outline: 'none', background: '#f8fafc',
  boxSizing: 'border-box',
};

const eyeBtnStyle = {
  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
  color: '#1e40af', display: 'flex', alignItems: 'center',
};

function EyeOn() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
