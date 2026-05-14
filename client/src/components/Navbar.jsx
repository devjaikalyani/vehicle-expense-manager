import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isManager = user?.role === 'manager' || user?.role === 'admin';

  const handleLogout = () => { logout(); navigate('/login'); };

  const navLink = (to, label) => (
    <Link
      to={to}
      style={{ fontWeight: pathname === to ? '700' : '400', color: pathname === to ? 'white' : 'rgba(255,255,255,0.8)' }}
    >
      {label}
    </Link>
  );

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        Vehicle Expense Manager
      </div>
      <div className="navbar-links">
        {navLink('/', 'Dashboard')}
        {navLink('/trips', 'My Trips')}
        {isManager && navLink('/manager', 'Manager')}
        {isManager && navLink('/live-map', 'Live Map')}
        <span className="navbar-user">{user?.name}</span>
        <button className="btn-logout" onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}
