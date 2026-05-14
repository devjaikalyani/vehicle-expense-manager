import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const handleLogout = () => { logout(); navigate('/login'); setOpen(false); };

  const link = (to, label) => (
    <Link
      key={to}
      to={to}
      className={pathname === to ? 'nav-active' : ''}
      onClick={() => setOpen(false)}
    >
      {label}
    </Link>
  );

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">Vehicle Expense Manager</div>

        <div className="navbar-links">
          {link('/', 'Dashboard')}
          {link('/trips', 'My Trips')}
          {isManager && link('/manager', 'Manager')}
          {isManager && link('/live-map', 'Live Map')}
          <span className="navbar-user">{user?.name}</span>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>

        <button
          className="hamburger"
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span style={{ transform: open ? 'rotate(45deg) translateY(7px)' : 'none' }} />
          <span style={{ opacity: open ? 0 : 1, transform: open ? 'scaleX(0)' : 'none' }} />
          <span style={{ transform: open ? 'rotate(-45deg) translateY(-7px)' : 'none' }} />
        </button>
      </nav>

      <div className={`mobile-nav ${open ? 'open' : ''}`}>
        {link('/', 'Dashboard')}
        {link('/trips', 'My Trips')}
        {isManager && link('/manager', 'Manager')}
        {isManager && link('/live-map', 'Live Map')}
        <div className="mobile-nav-footer">
          <span className="navbar-user" style={{ borderLeft: 'none', marginLeft: 0 }}>{user?.name}</span>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </>
  );
}
