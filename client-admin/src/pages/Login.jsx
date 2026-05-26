import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

// view: 'login' | 'otp-email' | 'otp-verify' | 'otp-password'

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const [showPw, setShowPw] = useState(false);

  const [view, setView] = useState('login');
  const [otpMode, setOtpMode] = useState('forgot'); // 'forgot' | 'setup'
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [setupName, setSetupName] = useState('');
  const [otpMsg, setOtpMsg] = useState(null);
  const [otpLoading, setOtpLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const openOtp = (mode) => {
    setOtpMode(mode);
    setOtpEmail('');
    setOtpCode('');
    setResetToken('');
    setNewPw('');
    setConfirmPw('');
    setSetupName('');
    setOtpMsg(null);
    setView('otp-email');
  };

  const sendOtp = async (e) => {
    e.preventDefault();
    setOtpMsg(null);
    setOtpLoading(true);
    try {
      await axios.post('/api/auth/send-otp', { email: otpEmail });
      setOtpMsg({ type: 'success', text: `OTP sent to ${otpEmail}. Check your inbox.` });
      setTimeout(() => { setOtpMsg(null); setView('otp-verify'); }, 1200);
    } catch (err) {
      setOtpMsg({ type: 'error', text: err.response?.data?.error || 'Failed to send OTP.' });
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setOtpMsg(null);
    setOtpLoading(true);
    try {
      const res = await axios.post('/api/auth/verify-otp', { email: otpEmail, otp: otpCode, mode: otpMode });
      setResetToken(res.data.resetToken);
      setOtpMsg({ type: 'success', text: 'OTP verified.' });
      setTimeout(() => { setOtpMsg(null); setView('otp-password'); }, 800);
    } catch (err) {
      setOtpMsg({ type: 'error', text: err.response?.data?.error || 'Invalid OTP.' });
    } finally {
      setOtpLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setOtpMsg(null);
    if (newPw !== confirmPw) return setOtpMsg({ type: 'error', text: 'Passwords do not match.' });
    setOtpLoading(true);
    try {
      await axios.post('/api/auth/reset-password', { resetToken, new_password: newPw, name: setupName });
      setOtpMsg({ type: 'success', text: 'Password set successfully! You can now sign in.' });
      setTimeout(() => { setView('login'); setOtpMsg(null); }, 2000);
    } catch (err) {
      setOtpMsg({ type: 'error', text: err.response?.data?.error || 'Failed to reset password.' });
    } finally {
      setOtpLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    background: '#f8fafc',
    border: '1.5px solid #e2e8f0',
    borderRadius: '12px',
    color: '#1e293b',
    fontSize: '0.925rem',
    outline: 'none',
    transition: 'all 0.18s',
    boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block',
    fontWeight: '700',
    marginBottom: '0.4rem',
    fontSize: '0.72rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  };
  const onFocus = (e) => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; e.target.style.background = '#fff'; };
  const onBlur = (e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#f8fafc'; };

  const modeLabel = otpMode === 'forgot' ? 'Forgot Password' : 'Set Up Account';
  const modeSubtitle = otpMode === 'forgot'
    ? 'Enter your email to receive a verification code'
    : 'Enter your registered email to activate your account';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      background: 'linear-gradient(145deg, #f0f4ff 0%, #faf5ff 50%, #f5f0ff 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '10%', left: '15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '18px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 8px 32px rgba(102,126,234,0.35)',
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <path d="M16 8h4l3 5v3h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <h1 style={{
            fontSize: '1.6rem', fontWeight: '800', letterSpacing: '-0.03em',
            display: 'inline-block',
            background: 'linear-gradient(135deg, #6366f1, #7c3aed, #8b5cf6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Employee Vehicle Manager
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.4rem' }}>
            {view === 'login' ? 'Sign in to your account' : modeSubtitle}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid rgba(139,92,246,0.15)',
          borderRadius: '24px',
          padding: '2rem',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 24px 64px rgba(99,102,241,0.1), 0 4px 16px rgba(0,0,0,0.06)',
        }}>

          {/* ── LOGIN VIEW ── */}
          {view === 'login' && (
            <>
              {error && <AlertBox type="error" text={error} />}
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required autoFocus style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password" required style={{ ...inputStyle, paddingRight: '2.75rem' }} onFocus={onFocus} onBlur={onBlur} />
                    <button type="button" onClick={() => setShowPw(v => !v)} style={{
                      position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem',
                      color: '#6366f1', display: 'flex', alignItems: 'center', zIndex: 2,
                    }}>
                      {showPw ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} style={submitBtnStyle(loading)}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                  <button type="button" onClick={() => openOtp('forgot')} style={linkBtnStyle}>
                    Forgot Password
                  </button>
                  <button type="button" onClick={() => openOtp('setup')} style={linkBtnStyle}>
                    Set Up Account
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── SEND OTP VIEW ── */}
          {view === 'otp-email' && (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: '700', fontSize: '1rem', color: '#1e293b', marginBottom: '0.25rem' }}>{modeLabel}</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  {otpMode === 'forgot' ? 'We will send a 6-digit code to your email.' : 'Enter your company email to activate your account.'}
                </div>
              </div>
              {otpMsg && <AlertBox type={otpMsg.type} text={otpMsg.text} />}
              <form onSubmit={sendOtp}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={labelStyle}>Email Address</label>
                  <input type="email" value={otpEmail} onChange={e => setOtpEmail(e.target.value)}
                    placeholder="you@example.com" required autoFocus style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <button type="submit" disabled={otpLoading} style={submitBtnStyle(otpLoading)}>
                  {otpLoading ? 'Sending...' : 'Send OTP'}
                </button>
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setView('login')} style={linkBtnStyle}>
                    Back to Sign In
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── VERIFY OTP VIEW ── */}
          {view === 'otp-verify' && (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: '700', fontSize: '1rem', color: '#1e293b', marginBottom: '0.25rem' }}>Enter Verification Code</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  A 6-digit code was sent to <strong>{otpEmail}</strong>
                </div>
              </div>
              {otpMsg && <AlertBox type={otpMsg.type} text={otpMsg.text} />}
              <form onSubmit={verifyOtp}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={labelStyle}>OTP Code</label>
                  <input
                    type="text" inputMode="numeric" maxLength={6}
                    value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit code" required autoFocus
                    style={{ ...inputStyle, fontSize: '1.5rem', fontWeight: '700', letterSpacing: '0.25em', textAlign: 'center' }}
                    onFocus={onFocus} onBlur={onBlur}
                  />
                </div>
                <button type="submit" disabled={otpLoading || otpCode.length !== 6} style={submitBtnStyle(otpLoading || otpCode.length !== 6)}>
                  {otpLoading ? 'Verifying...' : 'Verify Code'}
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setView('otp-email')} style={linkBtnStyle}>Back</button>
                  <button type="button" onClick={sendOtp} disabled={otpLoading} style={linkBtnStyle}>Resend OTP</button>
                </div>
              </form>
            </>
          )}

          {/* ── SET NEW PASSWORD VIEW ── */}
          {view === 'otp-password' && (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: '700', fontSize: '1rem', color: '#1e293b', marginBottom: '0.25rem' }}>
                  {otpMode === 'forgot' ? 'Reset Password' : 'Create Your Account'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  {otpMode === 'setup' ? 'Enter your name and set a password.' : 'Choose a strong password for your account.'}
                </div>
              </div>
              {otpMsg && <AlertBox type={otpMsg.type} text={otpMsg.text} />}
              <form onSubmit={resetPassword}>
                {otpMode === 'setup' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={labelStyle}>Full Name</label>
                    <input
                      type="text" value={setupName} onChange={e => setSetupName(e.target.value)}
                      placeholder="e.g. Rahul Sharma" required autoFocus
                      style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                    />
                  </div>
                )}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>New Password</label>
                  <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                    placeholder="Min. 6 characters" minLength={6} required autoFocus
                    style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={labelStyle}>Confirm Password</label>
                  <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                    placeholder="Repeat new password" required
                    style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <button type="submit" disabled={otpLoading} style={submitBtnStyle(otpLoading)}>
                  {otpLoading ? 'Saving...' : otpMode === 'forgot' ? 'Reset Password' : 'Create Password'}
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          Contact your manager if you need access
        </p>
      </div>
    </div>
  );
}

function AlertBox({ type, text }) {
  const isError = type === 'error';
  return (
    <div style={{
      background: isError ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
      border: `1px solid ${isError ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
      borderRadius: '10px',
      padding: '0.75rem 1rem',
      color: isError ? '#dc2626' : '#059669',
      fontSize: '0.875rem',
      marginBottom: '1.25rem',
    }}>
      {text}
    </div>
  );
}

function submitBtnStyle(disabled) {
  return {
    width: '100%',
    padding: '0.9rem',
    background: disabled ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #667eea, #764ba2)',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontSize: '0.95rem',
    fontWeight: '700',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : '0 8px 28px rgba(102,126,234,0.4)',
    transition: 'all 0.18s',
    letterSpacing: '0.01em',
  };
}

const linkBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#6366f1',
  fontSize: '0.82rem',
  fontWeight: '600',
  cursor: 'pointer',
  padding: '0.25rem 0',
  textDecoration: 'none',
  transition: 'color 0.15s',
};
