import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import PageShell from '../components/PageShell';
import Button from '../components/Button';
import './ChangePasswordPage.css';

export default function ChangePasswordPage() {
  const { user, refreshUser } = useAuth();
  const navigate              = useNavigate();

  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [errors,   setErrors]   = useState([]);
  const [success,  setSuccess]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);

    if (next !== confirm) {
      setErrors(['New password and confirmation do not match.']);
      return;
    }
    if (next.length < 8) {
      setErrors(['Password must be at least 8 characters.']);
      return;
    }

    setSaving(true);
    try {
      await api.auth.changePassword(current, next);
      setSuccess(true);
      await refreshUser();
      setTimeout(() => navigate('/projects', { replace: true }), 1500);
    } catch (err) {
      // API returns { errors: [...] } on 400
      try {
        const body = JSON.parse(err.message.replace(/^API \d+: /, ''));
        setErrors(body.errors ?? [err.message]);
      } catch {
        setErrors([err.message ?? 'Failed to change password.']);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cp-page">
      <div className="cp-card">
        <div className="cp-header">
          <div className="cp-icon">🔐</div>
          <h1 className="cp-title">Change Your Password</h1>
          <p className="cp-sub">
            Hi <strong>{user?.FullName}</strong> — a password change is required
            before you can access InfillTracker.
          </p>
        </div>

        {success ? (
          <div className="cp-success">
            <span>✓</span> Password changed successfully. Redirecting…
          </div>
        ) : (
          <form className="cp-form" onSubmit={handleSubmit}>
            <Field label="Current Password" id="current" type="password"
              value={current} onChange={e => setCurrent(e.target.value)}
              placeholder="Your current password" autoComplete="current-password" />

            <Field label="New Password" id="next" type="password"
              value={next} onChange={e => setNext(e.target.value)}
              placeholder="Min. 8 chars, upper, digit, symbol"
              autoComplete="new-password" />

            <Field label="Confirm New Password" id="confirm" type="password"
              value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat new password" autoComplete="new-password" />

            {errors.length > 0 && (
              <ul className="cp-errors">
                {errors.map((e, i) => <li key={i}>⚠ {e}</li>)}
              </ul>
            )}

            <Button type="submit" variant="accent" size="lg"
              disabled={saving || !current || !next || !confirm}>
              {saving ? 'Saving…' : 'Set New Password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, id, ...props }) {
  return (
    <div className="cp-field">
      <label className="cp-label" htmlFor={id}>{label}</label>
      <input id={id} className="cp-input" required {...props} />
    </div>
  );
}
