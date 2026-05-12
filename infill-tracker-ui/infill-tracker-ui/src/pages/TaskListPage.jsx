import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import PageShell from '../components/PageShell';
import Button from '../components/Button';
import { ErrorMessage, EmptyState } from '../components/Feedback';
import './TaskListPage.css';

// ── Filter options ────────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'all',        label: 'All'         },
  { key: 'todo',       label: 'To Do'       },
  { key: 'inprogress', label: 'In Progress' },
  { key: 'completed',  label: 'Completed'   },
];

export default function TaskListPage() {
  const { projectId } = useParams();
  const navigate      = useNavigate();
  const [filter, setFilter]       = useState('all');
  const [loadingId, setLoadingId] = useState(null); // tracks which row is mid-request

  const { data: project } = useApi(() => api.projects.get(Number(projectId)), [projectId]);
  const { data: tasks, loading, error, refetch } = useApi(
    () => api.tasks.listByProject(Number(projectId)),
    [projectId]
  );

  // ── Sort by dependency count asc (fewest blockers first = earliest startable)
  const sorted = useMemo(() => {
    if (!tasks) return [];
    return [...tasks].sort((a, b) => a.DependencyCount - b.DependencyCount);
  }, [tasks]);

  // ── Apply filter
  const filtered = useMemo(() => {
    switch (filter) {
      case 'todo':        return sorted.filter(t => !t.OwnerStartDate && !t.IsCompleted);
      case 'inprogress':  return sorted.filter(t =>  t.OwnerStartDate && !t.IsCompleted);
      case 'completed':   return sorted.filter(t =>  t.IsCompleted);
      default:            return sorted;
    }
  }, [sorted, filter]);

  // ── Counts for filter badges
  const counts = useMemo(() => {
    if (!tasks) return {};
    return {
      all:        tasks.length,
      todo:       tasks.filter(t => !t.OwnerStartDate && !t.IsCompleted).length,
      inprogress: tasks.filter(t =>  t.OwnerStartDate && !t.IsCompleted).length,
      completed:  tasks.filter(t =>  t.IsCompleted).length,
    };
  }, [tasks]);

  // ── Action handlers ───────────────────────────────────────────────────────
  const handle = (id, action) => async () => {
    setLoadingId(id);
    try { await action(); await refetch(); }
    finally { setLoadingId(null); }
  };

  const onStart = (task) => {
    if (task.OwnerStartDate) {
      // Already started — return a handler function that undoes start on click
      return handle(task.Id, () => api.tasks.undoStart(task.Id));
    }
    // Not yet started — set OwnerStartDate = Now, then navigate to Task Details
    return async () => {
      setLoadingId(task.Id);
      try {
        await api.tasks.start(task.Id);
        navigate(`/projects/${projectId}/tasks/${task.Id}`);
      } finally {
        setLoadingId(null);
      }
    };
  };

  const onComplete = (task) => handle(task.Id, () =>
    task.IsCompleted
      ? api.tasks.undoComplete(task.Id)
      : api.tasks.markComplete(task.Id)
  );

  const completedCount = counts.completed ?? 0;
  const totalCount     = counts.all       ?? 0;
  const progressPct    = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <PageShell
      title={project?.Name ?? 'Task List'}
      subtitle={project?.Address}
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
          ← Projects
        </Button>
      }
    >
      {/* ── Progress summary bar ─────────────────────────────────────────── */}
      {tasks && (
        <div className="tl-summary">
          <div className="tl-summary__stats">
            <span className="tl-summary__stat">
              <strong>{completedCount}</strong> completed
            </span>
            <span className="tl-summary__divider" />
            <span className="tl-summary__stat">
              <strong>{counts.inprogress}</strong> in progress
            </span>
            <span className="tl-summary__divider" />
            <span className="tl-summary__stat">
              <strong>{counts.todo}</strong> to do
            </span>
          </div>
          <div className="tl-summary__track">
            <div
              className="tl-summary__fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="tl-summary__pct">{progressPct}%</span>
        </div>
      )}

      {/* ── Filter tabs ──────────────────────────────────────────────────── */}
      <div className="tl-filters">
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`tl-filter ${filter === f.key ? 'tl-filter--active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="tl-filter__count">{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* ── States ───────────────────────────────────────────────────────── */}
      {loading && (
        <div className="tl-loading">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="tl-skeleton-row">
              <div className="skeleton" style={{ width: 52, height: 14 }} />
              <div className="skeleton" style={{ width: '28%', height: 14 }} />
              <div className="skeleton" style={{ width: '14%', height: 14 }} />
              <div className="skeleton" style={{ width: 80,  height: 14 }} />
              <div className="skeleton" style={{ width: 72,  height: 28, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 72,  height: 28, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 72,  height: 28, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          icon={filter === 'completed' ? '✅' : '📋'}
          title={filter === 'all' ? 'No tasks found' : `No ${FILTERS.find(f=>f.key===filter)?.label} tasks`}
          description={filter !== 'all' ? 'Try switching to a different filter.' : undefined}
        />
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="tl-table-wrap">
          <table className="tl-table">
            <thead>
              <tr>
                <th className="tl-th tl-th--code">Code</th>
                <th className="tl-th tl-th--name">Task Name</th>
                <th className="tl-th tl-th--owner">Owner</th>
                <th className="tl-th tl-th--date">Start Date</th>
                <th className="tl-th tl-th--deps">Deps</th>
                <th className="tl-th tl-th--actions" colSpan={3}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task, i) => (
                <TaskRow
                  key={task.Id}
                  task={task}
                  index={i}
                  busy={loadingId === task.Id}
                  onDetails={() => navigate(`/projects/${projectId}/tasks/${task.Id}`)}
                  onStart={onStart(task)}
                  onComplete={onComplete(task)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}

// ── TaskRow ───────────────────────────────────────────────────────────────────
function TaskRow({ task, index, busy, onDetails, onStart, onComplete }) {
  const isStarted   = !!task.OwnerStartDate;
  const isCompleted = task.IsCompleted;

  const rowClass = [
    'tl-row',
    index % 2 === 0 ? 'tl-row--even' : 'tl-row--odd',
    isCompleted ? 'tl-row--completed' : '',
  ].filter(Boolean).join(' ');

  const startDate = task.OwnerStartDate
    ? String(task.OwnerStartDate).slice(0, 10)
    : '—';

  return (
    <tr className={rowClass}>
      {/* Code */}
      <td className="tl-td tl-td--code">
        <span className="tl-code">{task.ExcelCode ?? '—'}</span>
      </td>

      {/* Task name */}
      <td className="tl-td tl-td--name">
        <span className={`tl-name ${isCompleted ? 'tl-name--done' : ''}`}>
          {task.TaskName}
        </span>
      </td>

      {/* Owner */}
      <td className="tl-td tl-td--owner">
        {task.TaskOwnerName
          ? <span className="tl-owner">{task.TaskOwnerName}</span>
          : <span className="tl-empty">—</span>}
      </td>

      {/* Start date */}
      <td className="tl-td tl-td--date">
        <span className={startDate === '—' ? 'tl-empty' : 'tl-date'}>
          {startDate}
        </span>
      </td>

      {/* Dependency count */}
      <td className="tl-td tl-td--deps">
        <span className={`tl-dep-badge ${task.DependencyCount === 0 ? 'tl-dep-badge--zero' : ''}`}>
          {task.DependencyCount}
        </span>
      </td>

      {/* Details button */}
      <td className="tl-td tl-td--btn">
        <button className="tl-btn tl-btn--details" onClick={onDetails} disabled={busy}>
          Details
        </button>
      </td>

      {/* Start / Started toggle */}
      <td className="tl-td tl-td--btn">
        <button
          className={`tl-btn ${isStarted ? 'tl-btn--started' : 'tl-btn--start'}`}
          onClick={onStart}
          disabled={busy || isCompleted}
          title={
            isCompleted      ? 'Undo complete first before undoing start' :
            isStarted        ? 'Click to undo started' :
                               'Go to Task Details to assign an owner and start'
          }
        >
          {busy ? '…' : isStarted ? 'Started ✓' : '▶ Start'}
        </button>
      </td>

      {/* Complete / Completed toggle */}
      <td className="tl-td tl-td--btn">
        <button
          className={`tl-btn ${isCompleted ? 'tl-btn--completed' : 'tl-btn--complete'}`}
          onClick={onComplete}
          disabled={busy}
        >
          {busy ? '…' : isCompleted ? 'Completed ✓' : 'Complete'}
        </button>
      </td>
    </tr>
  );
}
