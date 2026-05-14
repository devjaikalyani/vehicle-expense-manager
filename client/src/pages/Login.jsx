import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
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

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      background: '#0f0d1e',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glows */}
      <div style={{ position: 'absolute', top: '10%', left: '15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', right: '25%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,172,254,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 8px 32px rgba(102,126,234,0.45)',
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <path d="M16 8h4l3 5v3h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <h1 style={{
            fontSize: '1.6rem',
            fontWeight: '800',
            letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #a78bfa, #818cf8, #c4b5fd)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Vehicle Expense Manager
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', marginTop: '0.4rem' }}>
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: '24px',
          padding: '2rem',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              color: '#fca5a5',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: '700', marginBottom: '0.4rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid rgba(139,92,246,0.2)',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '0.925rem',
                  outline: 'none',
                  transition: 'all 0.18s',
                }}
                onFocus={e => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(139,92,246,0.2)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ display: 'block', fontWeight: '700', marginBottom: '0.4rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid rgba(139,92,246,0.2)',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '0.925rem',
                  outline: 'none',
                  transition: 'all 0.18s',
                }}
                onFocus={e => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(139,92,246,0.2)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.9rem',
                background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #667eea, #764ba2)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontSize: '0.95rem',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 8px 28px rgba(102,126,234,0.5)',
                transition: 'all 0.18s',
                letterSpacing: '0.01em',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          Contact your manager if you need access
        </p>
      </div>
    </div>
  );
}
