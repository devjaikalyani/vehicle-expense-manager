import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api';
import BottomNav from './components/BottomNav';
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
  if (!localStorage.getItem('vem_onboarded') && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

function Layout({ children }) {
  return (
    <div style={{ minHeight: '100%', paddingBottom: 64 }}>
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
    <AuthContext.Provider value={{ user, setUser, loading }}>
      <BrowserRouter basename="/m">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
          <Route path="/" element={<RequireAuth><Layout><Home /></Layout></RequireAuth>} />
          <Route path="/start-trip" element={<RequireAuth><Layout><StartTrip /></Layout></RequireAuth>} />
          <Route path="/end-trip" element={<RequireAuth><Layout><EndTrip /></Layout></RequireAuth>} />
          <Route path="/history" element={<RequireAuth><Layout><History /></Layout></RequireAuth>} />
          <Route path="/history/:id" element={<RequireAuth><Layout><TripDetail /></Layout></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Layout><Profile /></Layout></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
