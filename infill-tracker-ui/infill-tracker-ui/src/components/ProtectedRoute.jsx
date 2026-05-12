import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps a route that requires authentication.
 * Unauthenticated users are redirected to / with a flash message.
 * Optionally restricts to a specific role (e.g. "Administrator").
 */
export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const location          = useLocation();

  // Still checking session — render nothing to avoid flash
  if (loading) return null;

  // Not signed in — redirect home with the attempted path as state
  if (!user) {
    return (
      <Navigate
        to="/"
        replace
        state={{ authRequired: true, from: location.pathname }}
      />
    );
  }

  // Signed in but wrong role
  if (role && user.Role !== role) {
    return <Navigate to="/projects" replace />;
  }

  // Must change password — redirect to change password page
  if (user.MustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return children;
}
