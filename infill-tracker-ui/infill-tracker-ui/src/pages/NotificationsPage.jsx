import { useState } from 'react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import PageShell from '../components/PageShell';
import Button from '../components/Button';
import { ErrorMessage, EmptyState } from '../components/Feedback';
import './NotificationsPage.css';

export default function NotificationsPage() {
  const [sending,    setSending]    = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [sendError,  setSendError]  = useState(null);

  const { data: logs, loading, error, refetch } =
    useApi(() => api.notifications.logs(100), []);

  const handleSend = async () => {
    setSending(true);
    setSendResult(null);
    setSendError(null);
    try {
      const result = await api.notifications.send();
      setSendResult(result);
      refetch(); // refresh the log
    } catch (err) {
      setSendError(err.message ?? 'Failed to send notifications.');
    } finally {
      setSending(false);
    }
  };

  const successCount = logs?.filter(l => l.Success).length  ?? 0;
  const failCount    = logs?.filter(l => !l.Success).length ?? 0;

  return (
    <PageShell
      title="Notifications"
      subtitle="Email alerts for unblocked and overdue tasks"
    >
      {/* ── Config notice ──────────────────────────────────────────────── */}
      <div className="notif-config-notice">
        <span className="notif-config-notice__icon">⚙</span>
        <div>
          <strong>Configuration required</strong>
          <p>
            Set your SendGrid API key, sender address, and admin email in{' '}
            <code>InfillTracker.API/appsettings.json</code> before sending.
            Notifications also run automatically each day at the configured time (default 07:00).
          </p>
        </div>
      </div>

      {/* ── Manual send panel ──────────────────────────────────────────── */}
      <div className="notif-send-panel">
        <div className="notif-send-panel__left">
          <h2 className="notif-send-panel__title">Manual Send</h2>
          <p className="notif-send-panel__desc">
            Runs a full notification check right now — sends emails for any
            unblocked or overdue tasks that haven't been notified today.
          </p>

          {/* Result */}
          {sendResult && (
            <div className="notif-result">
              <span className="notif-result__icon">✓</span>
              <div>
                <strong>Notification run complete</strong>
                <p>
                  {sendResult.UnblockedEmailsSent} unblocked +{' '}
                  {sendResult.OverdueEmailsSent} overdue ={' '}
                  <strong>{sendResult.TotalEmailsSent} emails sent</strong>
                  {sendResult.TotalEmailsSent === 0 &&
                    ' — nothing new to notify (all already sent today or no qualifying tasks).'}
                </p>
              </div>
            </div>
          )}

          {sendError && <ErrorMessage message={sendError} />}
        </div>

        <div className="notif-send-panel__right">
          <Button
            variant="accent"
            size="lg"
            onClick={handleSend}
            disabled={sending}
            icon={sending ? '…' : '📧'}
          >
            {sending ? 'Sending…' : 'Send Notifications Now'}
          </Button>
        </div>
      </div>

      {/* ── Log ────────────────────────────────────────────────────────── */}
      <section>
        <div className="notif-log-header">
          <h2 className="notif-log-title">Notification Log</h2>
          <div className="notif-log-badges">
            {successCount > 0 && (
              <span className="notif-badge notif-badge--ok">✓ {successCount} sent</span>
            )}
            {failCount > 0 && (
              <span className="notif-badge notif-badge--fail">✕ {failCount} failed</span>
            )}
          </div>
        </div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />
            ))}
          </div>
        )}

        {error && <ErrorMessage message={error} />}

        {!loading && !error && logs?.length === 0 && (
          <EmptyState
            icon="📭"
            title="No notifications sent yet"
            description="Click 'Send Notifications Now' or wait for the daily run."
          />
        )}

        {!loading && !error && logs?.length > 0 && (
          <div className="notif-log-wrap">
            <table className="notif-log-table">
              <thead>
                <tr>
                  <th className="notif-th">Time</th>
                  <th className="notif-th">Event</th>
                  <th className="notif-th">Task</th>
                  <th className="notif-th">Project</th>
                  <th className="notif-th">Sent To</th>
                  <th className="notif-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.Id}
                    className={`notif-log-row ${i % 2 === 0 ? 'notif-log-row--even' : 'notif-log-row--odd'}`}>
                    <td className="notif-td notif-td--time">
                      {new Date(log.SentAt).toLocaleString('en-CA', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="notif-td">
                      <span className={`notif-event-chip notif-event-chip--${log.EventType.toLowerCase()}`}>
                        {log.EventType === 'Unblocked' ? '✦ Unblocked' : '⚠ Overdue'}
                      </span>
                    </td>
                    <td className="notif-td">
                      <span className="notif-code">{log.ExcelCode ?? '—'}</span>{' '}
                      <span className="notif-task-name">{log.TaskName}</span>
                    </td>
                    <td className="notif-td notif-td--sub">{log.ProjectName}</td>
                    <td className="notif-td notif-td--sub notif-td--email">{log.SentTo}</td>
                    <td className="notif-td">
                      {log.Success
                        ? <span className="notif-status notif-status--ok">✓ Sent</span>
                        : <span className="notif-status notif-status--fail"
                            title={log.ErrorMessage ?? ''}>✕ Failed</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  );
}
