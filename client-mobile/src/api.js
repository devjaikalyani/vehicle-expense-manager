const BASE = '/api';

async function req(path, options = {}) {
  const r = await fetch(BASE + path, { credentials: 'include', ...options });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error || r.statusText);
  return json;
}

function post(path, body) {
  return req(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const api = {
  login: (email, password) => post('/auth/login', { email, password }),
  logout: () => post('/auth/logout', {}),
  me: () => req('/auth/me'),
  updateProfile: (data) => req('/auth/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  sendOtp: (email) => post('/auth/send-otp', { email }),
  verifyOtp: (email, otp, mode) => post('/auth/verify-otp', { email, otp, mode }),
  resetPassword: (resetToken, new_password, name) => post('/auth/reset-password', { resetToken, new_password, name }),
  vehicles: () => req('/employees/vehicles'),
  activeTrip: () => req('/trips/active'),
  startTrip: (data) => post('/trips/start', data),
  endTrip: (id, data) => post(`/trips/end/${id}`, data),
  myTrips: () => req('/trips'),
  trip: (id) => req(`/trips/${id}`),
  uploadPhotos: (tripId, files) => {
    const form = new FormData();
    files.forEach((f) => form.append('receipts', f));
    return fetch(`${BASE}/receipts/${tripId}`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then((r) => r.json());
  },
  receipts: (tripId) => req(`/receipts/${tripId}`),
  gpsTrack: (tripId) => req(`/gps/trip/${tripId}`),
};
