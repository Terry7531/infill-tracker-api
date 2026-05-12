import { useState } from 'react';
import { api } from '../api/client';
import Button from './Button';
import './CreateProjectModal.css';

export default function CreateProjectModal({ onClose, onCreated }) {
  const [name,    setName]    = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await api.projects.create({ Name: name.trim(), Address: address.trim() || null });
      onCreated();
    } catch (err) {
      setError(err.message ?? 'Failed to create project.');
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create new project"
      >
        <div className="modal__header">
          <h2 className="modal__title">New Project</h2>
          <p className="modal__sub">
            151 template tasks will be seeded automatically.
          </p>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal__form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="proj-name">
              Project Name <span className="form-required">*</span>
            </label>
            <input
              id="proj-name"
              className="form-input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. 1234 Oak Street 4-Plex"
              required
              autoFocus
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="proj-addr">Address</label>
            <input
              id="proj-addr"
              className="form-input"
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. 1234 Oak St, Edmonton, AB"
            />
          </div>

          {error && (
            <p className="modal__error">⚠ {error}</p>
          )}

          <div className="modal__actions">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={loading || !name.trim()}>
              {loading ? 'Creating…' : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
