import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ActiveTrip from './pages/ActiveTrip';
import TripHistory from './pages/TripHistory';
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
      <BottomNav />
    </div>
  );
}

function PrivateRoute({ managerOnly = false }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (managerOnly && user.role === 'employee') return <Navigate to="/" replace />;
  return <Layout />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<PrivateRoute />}>
            <Route path="/" element={<EmployeeDashboard />} />
            <Route path="/trip/active" element={<ActiveTrip />} />
            <Route path="/trips" element={<TripHistory />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route element={<PrivateRoute managerOnly />}>
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/live-map" element={<LiveMap />} />
            <Route path="/timeline" element={<TripTimeline />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
