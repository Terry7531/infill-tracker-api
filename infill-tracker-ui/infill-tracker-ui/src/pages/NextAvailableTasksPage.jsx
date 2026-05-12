import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import PageShell from '../components/PageShell';
import Button from '../components/Button';
import { ErrorMessage, EmptyState } from '../components/Feedback';
import './NextAvailableTasksPage.css';

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcDelayDays(task) {
  if (!task.OwnerStartDate || !task.TypicalTimelineDays) return 0;
  const start    = new Date(task.OwnerStartDate);
  const expected = new Date(start);
  expected.setDate(expected.getDate() + task.TypicalTimelineDays);
  const diff = Math.floor((TODAY - expected) / 86_400_000);
  return diff > 0 ? diff : 0;
}

function fmtDate(val) {
  if (!val) return '—';
  return String(val).slice(0, 10);
}

function taskStatus(task) {
  if (task.OwnerStartDate) return 'in-progress';
  return 'ready';
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NextAvailableTasksPage() {
  const { projectId } = useParams();
  const navigate      = useNavigate();

  const { data: project }                          = useApi(() => api.projects.get(Number(projectId)), [projectId]);
  const { data: tasks, loading, error, refetch }   = useApi(() => api.tasks.listUnblocked(Number(projectId)), [projectId]);

  // Group by ProjectStage, preserving the TypicalTimelineDays sort within each group
  const grouped = useMemo(() => {
    if (!tasks) return [];
    const map = new Map();
    tasks.forEach(t => {
      const stage = t.ProjectStage ?? 'Other';
      if (!map.has(stage)) map.set(stage, []);
      map.get(stage).push(t);
    });
    return Array.from(map.entries()).map(([stage, items]) => ({ stage, items }));
  }, [tasks]);

  const totalUnblocked = tasks?.length ?? 0;
  const delayed        = tasks?.filter(t => calcDelayDays(t) > 0).length ?? 0;
  const inProgress     = tasks?.filter(t => t.OwnerStartDate && !t.IsCompleted).length ?? 0;
  const readyToStart   = tasks?.filter(t => !t.OwnerStartDate).length ?? 0;

  return (
    <PageShell
      title={project ? `Next Available Tasks — ${project.Name}` : 'Next Available Tasks'}
      subtitle={project?.Address}
      actions={
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <Button variant="ghost" size="sm"
            onClick={() => navigate(`/projects/${projectId}/tasks`)}>
            ☰ Task List
          </Button>
          <Button variant="ghost" size="sm"
            onClick={() => navigate('/projects')}>
            ← Projects
          </Button>
        </div>
      }
    >
      {/* ── Summary strip ─────────────────────────────────────────────────── */}
      {tasks && (
        <div className="nat-strip">
          <div className="nat-strip__item">
            <span className="nat-strip__val">{totalUnblocked}</span>
            <span className="nat-strip__lbl">Unblocked Tasks</span>
          </div>
          <div className="nat-strip__divider" />
          <div className="nat-strip__item">
            <span className="nat-strip__val nat-strip__val--blue">{inProgress}</span>
            <span className="nat-strip__lbl">In Progress</span>
          </div>
          <div className="nat-strip__divider" />
          <div className="nat-strip__item">
            <span className="nat-strip__val nat-strip__val--green">{readyToStart}</span>
            <span className="nat-strip__lbl">Ready to Start</span>
          </div>
          {delayed > 0 && (
            <>
              <div className="nat-strip__divider" />
              <div className="nat-strip__item">
                <span className="nat-strip__val nat-strip__val--red">{delayed}</span>
                <span className="nat-strip__lbl">Delayed</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── States ────────────────────────────────────────────────────────── */}
      {loading && <LoadingSkeleton />}
      {error   && <ErrorMessage message={error} />}

      {!loading && !error && totalUnblocked === 0 && (
        <EmptyState
          icon="🎉"
          title="No unblocked tasks"
          description="Either all tasks are completed or every remaining task is waiting on a dependency."
          action={
            <Button variant="secondary" onClick={() => navigate(`/projects/${projectId}/tasks`)}>
              View Task List
            </Button>
          }
        />
      )}

      {/* ── Stage groups ──────────────────────────────────────────────────── */}
      {!loading && !error && grouped.map(({ stage, items }) => (
        <div key={stage} className="nat-group">
          <div className="nat-group__header">
            <h2 className="nat-group__title">{stage}</h2>
            <span className="nat-group__count">{items.length} task{items.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="nat-cards">
            {items.map((task, i) => (
              <TaskCard
                key={task.Id}
                task={task}
                index={i}
                onDetails={() => navigate(`/projects/${projectId}/tasks/${task.Id}`)}
                refetch={refetch}
              />
            ))}
          </div>
        </div>
      ))}
    </PageShell>
  );
}

// ── TaskCard ──────────────────────────────────────────────────────────────────
function TaskCard({ task, index, onDetails, refetch }) {
  const delayDays  = calcDelayDays(task);
  const status     = taskStatus(task);
  const maxDays    = 60; // cap for the timeline bar display

  return (
    <article
      className={`nat-card nat-card--${status} ${delayDays > 0 ? 'nat-card--delayed' : ''} animate-fade-up`}
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      {/* ── Card header ───────────────────────────────────────────────────── */}
      <div className="nat-card__head">
        <div className="nat-card__identity">
          <span className="nat-card__code">{task.ExcelCode ?? '—'}</span>
          <h3 className="nat-card__name">{task.TaskName}</h3>
        </div>

        {/* Status / delay chips */}
        <div className="nat-card__chips">
          {delayDays > 0 && (
            <span className="nat-chip nat-chip--delayed">
              ⚠ {delayDays}d delayed
            </span>
          )}
          {status === 'in-progress' && delayDays === 0 && (
            <span className="nat-chip nat-chip--progress">▶ In Progress</span>
          )}
          {status === 'ready' && (
            <span className="nat-chip nat-chip--ready">✦ Ready to Start</span>
          )}
          {task.DependentCount > 0 && (
            <span className="nat-chip nat-chip--unlocks"
              title={`Completing this task unlocks ${task.DependentCount} other task(s)`}>
              🔓 Unlocks {task.DependentCount}
            </span>
          )}
        </div>
      </div>

      {/* ── Secondary fields ──────────────────────────────────────────────── */}
      <div className="nat-card__meta">
        <MetaItem icon="👤" label="Owner"      value={task.TaskOwnerName ?? '—'} />
        <MetaItem icon="📅" label="Started"    value={fmtDate(task.OwnerStartDate)} />
        <MetaItem icon="⏱"  label="Est. Days"  value={task.TypicalTimelineDays != null ? `${task.TypicalTimelineDays} days` : '—'} />
        {task.VendorName && (
          <MetaItem icon="🏢" label="Vendor" value={task.VendorName} />
        )}
      </div>

      {/* ── Timeline bar ──────────────────────────────────────────────────── */}
      {task.TypicalTimelineDays != null && (
        <div className="nat-card__timeline">
          <div className="nat-card__timeline-track">
            <div
              className={`nat-card__timeline-fill nat-card__timeline-fill--${delayDays > 0 ? 'delayed' : status}`}
              style={{ width: `${Math.min(100, (task.TypicalTimelineDays / maxDays) * 100)}%` }}
            />
          </div>
          <span className="nat-card__timeline-label">
            {task.TypicalTimelineDays}d est.
            {delayDays > 0 && <span className="nat-card__timeline-over"> +{delayDays}d over</span>}
          </span>
        </div>
      )}

      {/* ── Footer actions ────────────────────────────────────────────────── */}
      <div className="nat-card__footer">
        <Button variant="secondary" size="sm" onClick={onDetails}>
          View Details →
        </Button>
      </div>
    </article>
  );
}

// ── MetaItem ──────────────────────────────────────────────────────────────────
function MetaItem({ icon, label, value }) {
  return (
    <div className="nat-meta">
      <span className="nat-meta__icon">{icon}</span>
      <span className="nat-meta__label">{label}</span>
      <span className="nat-meta__value">{value}</span>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="nat-skeleton-wrap">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="nat-skeleton-card">
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div className="skeleton" style={{ width: 52,   height: 20 }} />
            <div className="skeleton" style={{ width: '50%', height: 20 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div className="skeleton" style={{ width: 80, height: 22, borderRadius: 100 }} />
            <div className="skeleton" style={{ width: 90, height: 22, borderRadius: 100 }} />
          </div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
            {[100, 80, 90].map((w, j) => (
              <div key={j} className="skeleton" style={{ width: w, height: 14 }} />
            ))}
          </div>
          <div className="skeleton" style={{ width: '100%', height: 6, borderRadius: 100 }} />
        </div>
      ))}
    </div>
  );
}
