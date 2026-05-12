import { useState } from 'react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import Button from '../components/Button';
import { ErrorMessage, EmptyState } from '../components/Feedback';
import './AdminPage.css';

export default function AdminPage() {
  const { user: currentUser }  = useAuth();
  const { data: users, loading, error, refetch } =
    useApi(() => api.admin.listUsers(), []);

  const [showCreate,  setShowCreate]  = useState(false);
  const [resetTarget, setResetTarget] = useState(null); // user to reset pw for

  return (
    <PageShell
      title="Administration"
      subtitle="Manage user and administrator accounts"
      actions={
        <Button variant="accent" icon="+"
          onClick={() => setShowCreate(true)}>
          Create Account
        </Button>
      }
    >
      {/* ── User table ───────────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />
          ))}
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      {!loading && !error && users?.length === 0 && (
        <EmptyState icon="👤" title="No accounts yet"
          action={<Button variant="accent" onClick={() => setShowCreate(true)}>Create first account</Button>} />
      )}

      {!loading && !error && users?.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-th">Name</th>
                <th className="admin-th">Email</th>
                <th className="admin-th">Role</th>
                <th className="admin-th">Created</th>
                <th className="admin-th">Status</th>
                <th className="admin-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <UserRow
                  key={u.Id}
                  user={u}
                  index={i}
                  isSelf={u.Id === currentUser?.Id}
                  onResetPassword={() => setResetTarget(u)}
                  onDelete={async () => {
                    if (!confirm(`Delete account for ${u.FullName}?`)) return;
                    await api.admin.deleteUser(u.Id);
                    refetch();
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refetch(); }}
        />
      )}

      {/* ── Reset password modal ──────────────────────────────────────── */}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onReset={() => { setResetTarget(null); refetch(); }}
        />
      )}
    </PageShell>
  );
}

// ── UserRow ───────────────────────────────────────────────────────────────────
function UserRow({ user: u, index, isSelf, onResetPassword, onDelete }) {
  const isAdmin = u.Role === 'Administrator';

  return (
    <tr className={`admin-row ${index % 2 === 0 ? 'admin-row--even' : 'admin-row--odd'}`}>
      <td className="admin-td admin-td--name">
        {u.FullName}
        {isSelf && <span className="admin-self-chip">You</span>}
      </td>
      <td className="admin-td admin-td--sub">{u.Email}</td>
      <td className="admin-td">
        <span className={`admin-role-chip ${isAdmin ? 'admin-role-chip--admin' : 'admin-role-chip--user'}`}>
          {isAdmin ? '⚡ Administrator' : '👤 User'}
        </span>
      </td>
      <td className="admin-td admin-td--sub">
        {new Date(u.CreatedAt).toLocaleDateString('en-CA')}
      </td>
      <td className="admin-td">
        {u.IsLockedOut
          ? <span className="admin-status admin-status--locked">🔒 Locked</span>
          : u.MustChangePassword
          ? <span className="admin-status admin-status--pending">⏳ Pw Change Required</span>
          : <span className="admin-status admin-status--active">✓ Active</span>
        }
      </td>
      <td className="admin-td">
        <div className="admin-actions">
          <button className="admin-action-btn" onClick={onResetPassword}>
            Reset Password
          </button>
          {!isSelf && (
            <button className="admin-action-btn admin-action-btn--danger"
              onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── CreateUserModal ───────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated }) {
  const [form,   setForm]   = useState({ FullName: '', Email: '', InitialPassword: '', Role: 'User' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);

  const set = (field) => (e) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors([]);
    try {
      await api.admin.createUser(form);
      onCreated();
    } catch (err) {
      try {
        const body = JSON.parse(err.message.replace(/^API \d+: /, ''));
        setErrors(body.errors ?? [err.message]);
      } catch {
        setErrors([err.message ?? 'Failed to create account.']);
      }
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={e => e.stopPropagation()}>
        <div className="admin-modal__header">
          <h2 className="admin-modal__title">Create Account</h2>
          <p className="admin-modal__sub">
            User will be required to change their password on first login.
          </p>
          <button className="admin-modal__close" onClick={onClose}>✕</button>
        </div>

        <form className="admin-modal__form" onSubmit={handleSubmit}>
          <AdminField label="Full Name *">
            <input className="admin-input" value={form.FullName}
              onChange={set('FullName')} placeholder="e.g. Jane Smith" required />
          </AdminField>
          <AdminField label="Email *">
            <input className="admin-input" type="email" value={form.Email}
              onChange={set('Email')} placeholder="jane@example.com" required />
          </AdminField>
          <AdminField label="Initial Password *">
            <input className="admin-input" type="password" value={form.InitialPassword}
              onChange={set('InitialPassword')}
              placeholder="Min. 8 chars, upper, digit, symbol" required />
          </AdminField>
          <AdminField label="Role *">
            <select className="admin-input admin-select"
              value={form.Role} onChange={set('Role')}>
              <option value="User">User</option>
              <option value="Administrator">Administrator</option>
            </select>
          </AdminField>

          {errors.length > 0 && (
            <ul className="admin-errors">
              {errors.map((e, i) => <li key={i}>⚠ {e}</li>)}
            </ul>
          )}

          <div className="admin-modal__actions">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="accent" disabled={saving}>
              {saving ? 'Creating…' : 'Create Account'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ResetPasswordModal ────────────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose, onReset }) {
  const [password, setPassword] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [errors,   setErrors]   = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors([]);
    try {
      await api.admin.resetPassword(user.Id, { NewPassword: password });
      onReset();
    } catch (err) {
      try {
        const body = JSON.parse(err.message.replace(/^API \d+: /, ''));
        setErrors(body.errors ?? [err.message]);
      } catch {
        setErrors([err.message ?? 'Failed to reset password.']);
      }
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={e => e.stopPropagation()}>
        <div className="admin-modal__header">
          <h2 className="admin-modal__title">Reset Password</h2>
          <p className="admin-modal__sub">
            Resetting password for <strong>{user.FullName}</strong>.
            They will be required to change it on next login.
          </p>
          <button className="admin-modal__close" onClick={onClose}>✕</button>
        </div>
        <form className="admin-modal__form" onSubmit={handleSubmit}>
          <AdminField label="New Password *">
            <input className="admin-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 chars, upper, digit, symbol"
              required autoFocus />
          </AdminField>

          {errors.length > 0 && (
            <ul className="admin-errors">
              {errors.map((e, i) => <li key={i}>⚠ {e}</li>)}
            </ul>
          )}

          <div className="admin-modal__actions">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={saving || !password}>
              {saving ? 'Resetting…' : 'Reset Password'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminField({ label, children }) {
  return (
    <div className="admin-field">
      <label className="admin-label">{label}</label>
      {children}
    </div>
  );
}
