import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';

export default function Profile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  async function handleLogout() {
    setLoggingOut(true);
    try { await api.logout(); } finally {
      setUser(null);
      navigate('/login', { replace: true });
    }
  }

  async function handleSave() {
    if (!name.trim()) { setEditError('Name is required'); return; }
    setEditError('');
    setSaving(true);
    try {
      const updated = await api.updateProfile({ name: name.trim(), phone: phone.trim() });
      setUser(prev => ({ ...prev, ...updated }));
      setEditing(false);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
        padding: '48px 20px 32px',
        color: '#fff', textAlign: 'center',
      }}>
        <div style={{
          width: 76, height: 76, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px', fontSize: 28, fontWeight: 700, color: '#fff',
          border: '3px solid rgba(255,255,255,0.4)',
        }}>
          {initials}
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>{user?.name}</h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 4, textTransform: 'capitalize' }}>{user?.role || 'employee'}</p>
      </div>

      <div style={{ padding: 16 }}>
        {/* Info / Edit card */}
        <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {/* Card header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Account Details</span>
            {!editing ? (
              <button
                onClick={() => { setEditing(true); setEditError(''); setName(user?.name || ''); setPhone(user?.phone || ''); }}
                style={{ fontSize: 13, fontWeight: 600, color: '#1e40af', background: '#eff6ff', padding: '4px 12px', borderRadius: 20 }}
              >
                Edit
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditing(false)} style={{ fontSize: 13, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '4px 12px', borderRadius: 20 }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: saving ? '#93c5fd' : '#1e40af', padding: '4px 12px', borderRadius: 20 }}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {editError && (
            <div style={{ background: '#fef2f2', padding: '8px 16px', color: '#dc2626', fontSize: 13 }}>
              {editError}
            </div>
          )}

          {/* Fields */}
          <InfoRow label="Email" value={user?.email} />

          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Name</p>
            {editing ? (
              <input
                value={name} onChange={e => setName(e.target.value)}
                style={{ width: '100%', fontSize: 14, fontWeight: 500, color: '#0f172a', border: 'none', outline: 'none', background: 'transparent', padding: 0 }}
              />
            ) : (
              <p style={{ fontSize: 14, fontWeight: 500, color: '#0f172a' }}>{user?.name || '-'}</p>
            )}
          </div>

          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Phone</p>
            {editing ? (
              <input
                value={phone} onChange={e => setPhone(e.target.value)}
                type="tel" inputMode="tel" placeholder="Enter phone number"
                style={{ width: '100%', fontSize: 14, fontWeight: 500, color: '#0f172a', border: 'none', outline: 'none', background: 'transparent', padding: 0 }}
              />
            ) : (
              <p style={{ fontSize: 14, fontWeight: 500, color: user?.phone ? '#0f172a' : '#cbd5e1' }}>{user?.phone || 'Not set'}</p>
            )}
          </div>

          <InfoRow label="Employee Code" value={user?.employee_code || 'Not assigned'} dim={!user?.employee_code} />
          <InfoRow label="Role" value={user?.role} capitalize last />
        </div>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            width: '100%', padding: '14px', borderRadius: 14, fontSize: 15, fontWeight: 600,
            background: loggingOut ? '#fecaca' : '#fef2f2', color: '#dc2626',
            border: '1px solid #fecaca',
          }}
        >
          {loggingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value, dim, capitalize, last }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: last ? 'none' : '1px solid #f1f5f9' }}>
      <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 500, color: dim ? '#cbd5e1' : '#0f172a', textTransform: capitalize ? 'capitalize' : 'none' }}>
        {value || 'Not set'}
      </p>
    </div>
  );
}
