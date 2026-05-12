import { useState } from 'react';
import { api } from '../api/client';
import './AddPersonModal.css';

/**
 * Reusable quick-add modal for TaskOwner and Vendor.
 *
 * Props:
 *   type        'owner' | 'vendor'
 *   onClose     () => void
 *   onCreated   (newRecord) => void   — called with the saved record so the
 *                                       parent can append it to its list and
 *                                       auto-select it in the dropdown
 */
export default function AddPersonModal({ type, onClose, onCreated }) {
  const isOwner = type === 'owner';
  const label   = isOwner ? 'Task Owner' : 'Vendor';

  const [name,        setName]        = useState('');
  const [phone,       setPhone]       = useState('');
  const [email,       setEmail]       = useState('');
  const [contactInfo, setContactInfo] = useState(''); // vendor only
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let record;
      if (isOwner) {
        record = await api.taskOwners.create({
          Name:        name.trim(),
          PhoneNumber: phone.trim()  || null,
          Email:       email.trim()  || null,
        });
      } else {
        record = await api.vendors.create({
          Name:        name.trim(),
          PhoneNumber: phone.trim()       || null,
          Email:       email.trim()       || null,
          ContactInfo: contactInfo.trim() || null,
        });
      }
      onCreated(record);
    } catch (err) {
      setError(err.message ?? `Failed to create ${label}.`);
      setSaving(false);
    }
  };

  return (
    <div className="apm-backdrop" onClick={onClose}>
      <div className="apm" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">

        {/* Header */}
        <div className="apm__header">
          <div>
            <h3 className="apm__title">Add {label}</h3>
            <p className="apm__sub">New {label.toLowerCase()} will be available in all dropdowns.</p>
          </div>
          <button className="apm__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Form */}
        <form className="apm__form" onSubmit={handleSubmit}>
          <div className="apm__field">
            <label className="apm__label">
              Name <span className="apm__required">*</span>
            </label>
            <input
              className="apm__input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={isOwner ? 'e.g. Jane Smith' : 'e.g. Acme Plumbing Ltd'}
              required
              autoFocus
            />
          </div>

          <div className="apm__row">
            <div className="apm__field">
              <label className="apm__label">Phone</label>
              <input
                className="apm__input"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 780-555-0100"
                type="tel"
              />
            </div>
            <div className="apm__field">
              <label className="apm__label">Email</label>
              <input
                className="apm__input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. jane@example.com"
                type="email"
              />
            </div>
          </div>

          {/* Vendor-only: contact info */}
          {!isOwner && (
            <div className="apm__field">
              <label className="apm__label">Contact / Notes</label>
              <input
                className="apm__input"
                value={contactInfo}
                onChange={e => setContactInfo(e.target.value)}
                placeholder="e.g. Ask for Mike, after 8am"
              />
            </div>
          )}

          {error && <p className="apm__error">⚠ {error}</p>}

          <div className="apm__actions">
            <button type="button" className="apm__btn apm__btn--ghost"
              onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="apm__btn apm__btn--accent"
              disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : `Add ${label}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
