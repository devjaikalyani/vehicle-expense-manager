import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import ManagerDashboard from './pages/ManagerDashboard';
import LiveMap from './pages/LiveMap';
import TripTimeline from './pages/TripTimeline';
import Profile from './pages/Profile';

function Layout() {
  return (
    <div className="app">
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function AdminRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'employee') return <Navigate to="/login" replace />;
  return <Layout />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AdminRoute />}>
            <Route path="/" element={<Navigate to="/manager" replace />} />
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/live-map" element={<LiveMap />} />
            <Route path="/timeline" element={<TripTimeline />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/manager" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
