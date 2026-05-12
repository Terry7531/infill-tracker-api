import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './SignInPage.css';

export default function SignInPage() {
  const { signIn }   = useAuth();
  const navigate     = useNavigate();
  const location     = useLocation();
  const from         = location.state?.from ?? '/projects';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await signIn(email.trim(), password);
      // If password change required the ProtectedRoute will redirect automatically
      if (user.MustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message?.includes('401')
        ? 'Invalid email or password.'
        : err.message ?? 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin-page">
      <div className="signin-bg" aria-hidden="true" />

      <div className="signin-card">
        {/* Logo */}
        <div className="signin-logo">
          <span className="signin-logo__mark">IT</span>
          <span className="signin-logo__text">InfillTracker</span>
        </div>

        <h1 className="signin-title">Sign In</h1>
        <p className="signin-sub">Enter your credentials to access the platform.</p>

        <form className="signin-form" onSubmit={handleSubmit}>
          <div className="signin-field">
            <label className="signin-label" htmlFor="email">Email</label>
            <input
              id="email"
              className="signin-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              autoComplete="email"
            />
          </div>

          <div className="signin-field">
            <label className="signin-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="signin-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="signin-error" role="alert">
              <span>⚠</span> {error}
            </div>
          )}

          <button
            type="submit"
            className="signin-btn"
            disabled={loading || !email || !password}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="signin-footer">
          Contact your administrator if you need an account.
        </p>
      </div>
    </div>
  );
}
