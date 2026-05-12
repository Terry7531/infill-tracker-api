import './Feedback.css';

export function ErrorMessage({ message }) {
  return (
    <div className="feedback feedback--error" role="alert">
      <span className="feedback__icon">⚠</span>
      <div>
        <strong>Something went wrong</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

export function EmptyState({ icon = '📋', title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__desc">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

export function LoadingGrid({ count = 3 }) {
  return (
    <div className="loading-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="loading-card">
          <div className="skeleton" style={{ height: 22, width: '60%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 20 }} />
          <div className="skeleton" style={{ height: 7,  width: '100%',marginBottom: 6  }} />
          <div className="skeleton" style={{ height: 12, width: '20%', marginBottom: 20 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="skeleton" style={{ height: 34, width: 120 }} />
            <div className="skeleton" style={{ height: 34, width: 120 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
