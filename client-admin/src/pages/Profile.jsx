import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

function avatarColor(name) {
  const colors = ['#667eea', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f5576c'];
  return colors[(name || '').charCodeAt(0) % colors.length];
}

function fmt(n) { return parseFloat(n || 0).toFixed(1); }

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ marginBottom: '1.25rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-solid)' }}>
        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

export default function Profile() {
  const { user: authUser, login } = useAuth();
  const [profile, setProfile] = useState(null);
  const [trips, setTrips] = useState([]);

  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  const [pwForm, setPwForm] = useState({ new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [pwModalOpen, setPwModalOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get('/api/auth/me'),
      axios.get('/api/trips'),
    ]).then(([meRes, tripsRes]) => {
      setProfile(meRes.data);
      setProfileForm({ name: meRes.data.name || '', phone: meRes.data.phone || '' });
      setTrips(tripsRes.data.filter(t => t.status !== 'active'));
    });
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await axios.patch('/api/auth/profile', profileForm);
      setProfile(res.data);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.error || 'Update failed.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (pwForm.new_password !== pwForm.confirm_password) {
      return setPwMsg({ type: 'error', text: 'New passwords do not match.' });
    }
    setPwSaving(true);
    try {
      await axios.patch('/api/auth/password', { new_password: pwForm.new_password });
      setPwMsg({ type: 'success', text: 'Password changed successfully.' });
      setPwForm({ new_password: '', confirm_password: '' });
      setTimeout(() => { setPwModalOpen(false); setPwMsg(null); }, 1200);
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.error || 'Failed to change password.' });
    } finally {
      setPwSaving(false);
    }
  };

  const completedTrips = trips.filter(t => t.status !== 'active');
  const approvedTrips = completedTrips.filter(t => t.status === 'approved');
  const totalKm = completedTrips.reduce((s, t) => s + parseFloat(t.manual_distance_km || t.gps_distance_km || 0), 0);

  if (!profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading profile...</div>
      </div>
    );
  }

  const initials = profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const color = avatarColor(profile.name);

  return (
    <div>
      {/* Hero header */}
      <div className="gradient-header" style={{ marginBottom: '1.1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 72, height: 72,
            borderRadius: '50%',
            background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.75rem', fontWeight: '800', color: 'white',
            border: '3px solid rgba(255,255,255,0.2)',
            flexShrink: 0,
            boxShadow: `0 4px 20px ${color}66`,
          }}>
            {initials}
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem' }}>{profile.name}</h1>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.4rem', alignItems: 'center' }}>
              <span className={`badge badge-${profile.role}`} style={{ fontSize: '0.7rem' }}>{profile.role}</span>
              {profile.employee_code && (
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', fontWeight: '500' }}>
                  {profile.employee_code}
                </span>
              )}
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem' }}>{profile.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      <div className="stats-grid">
        <div className="stat-card stat-card-indigo">
          <div className="stat-value">{completedTrips.length}</div>
          <div className="stat-label">Total Trips</div>
        </div>
        <div className="stat-card stat-card-ocean">
          <div className="stat-value">{fmt(totalKm)}</div>
          <div className="stat-label">Total KM</div>
        </div>
      </div>

      {/* Personal info */}
      <SectionCard title="Personal Information" subtitle="Update your display name and contact number">
        {profileMsg && (
          <div className={`alert alert-${profileMsg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '1rem' }}>
            {profileMsg.text}
          </div>
        )}
        <form onSubmit={saveProfile}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 1rem' }}>
            <div className="form-group">
              <label>Full Name *</label>
              <input
                value={profileForm.name}
                onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                value={profileForm.phone}
                onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                placeholder="e.g. +91 98765 43210"
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 1rem' }}>
            <div className="form-group">
              <label>Email Address</label>
              <input value={profile.email} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
            <div className="form-group">
              <label>Employee Code</label>
              <input value={profile.employee_code || '—'} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={profileSaving} style={{ minWidth: '140px' }}>
            {profileSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </SectionCard>

      {/* Change password — button triggers modal */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ marginBottom: '1rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-solid)' }}>
          <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text)', letterSpacing: '-0.01em' }}>Security</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Manage your account password</div>
        </div>
        <button
          className="btn btn-outline"
          style={{ minWidth: '160px' }}
          onClick={() => { setPwModalOpen(true); setPwMsg(null); setPwForm({ new_password: '', confirm_password: '' }); }}
        >
          Change Password
        </button>
      </div>

      {/* Change password modal */}
      {pwModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }} onClick={(e) => { if (e.target === e.currentTarget) { setPwModalOpen(false); setPwMsg(null); } }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-solid)',
            borderRadius: '1.1rem',
            padding: '1.75rem',
            width: '100%',
            maxWidth: '420px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          }}>
            <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text)', marginBottom: '0.3rem' }}>
              Change Password
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Choose a new password for your account.
            </div>

            {pwMsg && (
              <div className={`alert alert-${pwMsg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '1rem' }}>
                {pwMsg.text}
              </div>
            )}

            <form onSubmit={changePassword}>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={pwForm.new_password}
                  onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })}
                  placeholder="Min. 6 characters"
                  minLength={6}
                  autoFocus
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={pwForm.confirm_password}
                  onChange={e => setPwForm({ ...pwForm, confirm_password: e.target.value })}
                  placeholder="Repeat new password"
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" disabled={pwSaving}>
                  {pwSaving ? 'Saving...' : 'Save Password'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => { setPwModalOpen(false); setPwMsg(null); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account info (read-only) */}
      <SectionCard title="Account Details" subtitle="Read-only information managed by your administrator">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
          {[
            { label: 'Role', value: profile.role.charAt(0).toUpperCase() + profile.role.slice(1) },
            { label: 'Employee Code', value: profile.employee_code || '—' },
            { label: 'Email', value: profile.email },
            { label: 'Phone', value: profile.phone || '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-solid)',
              borderRadius: 'var(--radius)',
              padding: '0.85rem 1rem',
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
                {label}
              </div>
              <div style={{ fontWeight: '600', color: 'var(--text)', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
