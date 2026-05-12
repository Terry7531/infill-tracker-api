import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './NavBar.css';

const NAV_LINKS = [
  { to: '/',              label: 'Home',          public: true  },
  { to: '/dashboard',     label: 'Dashboard',     public: false },
  { to: '/projects',      label: 'Projects',      public: false },
  { to: '/notifications', label: 'Notifications', public: false },
];

export default function NavBar() {
  const { pathname }      = useLocation();
  const { user, signOut } = useAuth();
  const navigate          = useNavigate();
  const isAdmin           = user?.Role === 'Administrator';

  const isActive = (to) => {
    if (to === '/') return pathname === '/';
    return pathname.startsWith(to);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__logo">
          <span className="navbar__logo-mark">IT</span>
          <span className="navbar__logo-text">InfillTracker</span>
        </Link>

        <nav className="navbar__nav">
          {NAV_LINKS
            .filter(l => l.public || user)
            .map(({ to, label }) => (
              <Link key={to} to={to}
                className={`navbar__link ${isActive(to) ? 'navbar__link--active' : ''}`}>
                {label}
              </Link>
            ))}
          {isAdmin && (
            <Link to="/admin"
              className={`navbar__link ${isActive('/admin') ? 'navbar__link--active' : ''}`}>
              Admin
            </Link>
          )}
        </nav>

        <div className="navbar__actions">
          {user ? (
            <div className="navbar__user">
              <span className="navbar__user-name">{user.FullName}</span>
              <span className="navbar__user-role">{user.Role}</span>
              <button className="navbar__signout-btn" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          ) : (
            <Link to="/signin" className="navbar__login-btn">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
