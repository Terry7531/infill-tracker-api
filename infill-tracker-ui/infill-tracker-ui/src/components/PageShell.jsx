import './PageShell.css';

/**
 * PageShell — wraps every page with consistent max-width, padding, and
 * an optional page header (title + subtitle + right-side actions).
 */
export default function PageShell({ title, subtitle, actions, children }) {
  return (
    <main className="page-shell">
      <div className="page-shell__inner">
        {(title || actions) && (
          <div className="page-shell__header">
            <div className="page-shell__titles">
              {title    && <h1 className="page-shell__title">{title}</h1>}
              {subtitle && <p  className="page-shell__subtitle">{subtitle}</p>}
            </div>
            {actions && (
              <div className="page-shell__actions">{actions}</div>
            )}
          </div>
        )}
        <div className="page-shell__content">{children}</div>
      </div>
    </main>
  );
}
