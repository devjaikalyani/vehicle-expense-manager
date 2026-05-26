import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api';
import BottomNav from './components/BottomNav';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import EndTrip from './pages/EndTrip';
import History from './pages/History';
import Home from './pages/Home';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import StartTrip from './pages/StartTrip';
import TripDetail from './pages/TripDetail';

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1e40af' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!localStorage.getItem('evm_onboarded') && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return online;
}

function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  return prompt;
}

function Layout({ children }) {
  const online = useOnlineStatus();
  const installPrompt = useInstallPrompt();
  const [installDismissed, setInstallDismissed] = useState(false);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallDismissed(true);
  }

  return (
    <div style={{ minHeight: '100%', paddingBottom: 64 }}>
      {!online && (
        <div style={{
          position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480, zIndex: 9000,
          background: '#dc2626', color: '#fff',
          padding: '8px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600,
        }}>
          No internet connection
        </div>
      )}
      {installPrompt && !installDismissed && !isStandalone && (
        <div style={{
          position: 'fixed', bottom: 64, left: '50%', transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)', maxWidth: 448, zIndex: 8000,
          background: '#1e40af', color: '#fff', borderRadius: 14,
          padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 4px 20px rgba(30,64,175,0.4)',
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Add EVM Field to Home Screen</p>
            <p style={{ fontSize: 12, opacity: 0.8 }}>Works offline and loads faster</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 12 }}>
            <button
              onClick={() => setInstallDismissed(true)}
              style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Later
            </button>
            <button
              onClick={handleInstall}
              style={{ padding: '6px 12px', borderRadius: 8, background: '#fff', border: 'none', color: '#1e40af', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Install
            </button>
          </div>
        </div>
      )}
      {children}
      <BottomNav />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ErrorBoundary>
      <AuthContext.Provider value={{ user, setUser, loading }}>
        <BrowserRouter basename="/m">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
            <Route path="/" element={<RequireAuth><Layout><Home /></Layout></RequireAuth>} />
            <Route path="/start-trip" element={<RequireAuth><Layout><StartTrip /></Layout></RequireAuth>} />
            <Route path="/end-trip" element={<RequireAuth><Layout><EndTrip /></Layout></RequireAuth>} />
            <Route path="/dashboard" element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
            <Route path="/history" element={<RequireAuth><Layout><History /></Layout></RequireAuth>} />
            <Route path="/history/:id" element={<RequireAuth><Layout><TripDetail /></Layout></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><Layout><Profile /></Layout></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}
