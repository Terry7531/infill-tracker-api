import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import PageShell from '../components/PageShell';
import Button from '../components/Button';
import { ErrorMessage, EmptyState } from '../components/Feedback';
import './DashboardPage.css';

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function fmtDate(val) {
  if (!val) return '—';
  return String(val).slice(0, 10);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [selectedOwner, setSelectedOwner] = useState('');

  const { data: summaries, loading: sumLoading, error: sumError } =
    useApi(() => api.dashboard.summary(), []);
  const { data: owners } =
    useApi(() => api.dashboard.owners(), []);
  const { data: myTasks, loading: myLoading } =
    useApi(
      () => selectedOwner ? api.dashboard.myTasks(selectedOwner) : Promise.resolve([]),
      [selectedOwner]
    );

  // ── Totals across all projects ─────────────────────────────────────────────
  const totals = useMemo(() => {
    if (!summaries) return null;
    return {
      projects:   summaries.length,
      tasks:      summaries.reduce((s, p) => s + p.TotalTasks,     0),
      completed:  summaries.reduce((s, p) => s + p.CompletedTasks,  0),
      delayed:    summaries.reduce((s, p) => s + p.DelayedTasks,    0),
      unblocked:  summaries.reduce((s, p) => s + p.UnblockedTasks,  0),
    };
  }, [summaries]);

  return (
    <PageShell
      title="Dashboard"
      subtitle="Overview across all projects"
      actions={
        <Button variant="accent" size="sm"
          onClick={() => navigate('/projects')}>
          + New Project
        </Button>
      }
    >
      {/* ── Global totals strip ─────────────────────────────────────────── */}
      {totals && (
        <div className="db-totals">
          {[
            { val: totals.projects,  lbl: 'Projects',          cls: '' },
            { val: totals.tasks,     lbl: 'Total Tasks',        cls: '' },
            { val: totals.completed, lbl: 'Completed',          cls: 'green' },
            { val: totals.unblocked, lbl: 'Ready to Start',     cls: 'blue' },
            { val: totals.delayed,   lbl: 'Delayed',            cls: totals.delayed > 0 ? 'red' : '' },
          ].map(({ val, lbl, cls }) => (
            <div key={lbl} className="db-totals__item">
              <span className={`db-totals__val ${cls ? `db-totals__val--${cls}` : ''}`}>{val}</span>
              <span className="db-totals__lbl">{lbl}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Project summaries ────────────────────────────────────────────── */}
      <section className="db-section">
        <h2 className="db-section__title">Projects</h2>

        {sumLoading && <ProjectSkeletons />}
        {sumError   && <ErrorMessage message={sumError} />}

        {!sumLoading && !sumError && summaries?.length === 0 && (
          <EmptyState icon="🏗️" title="No projects yet"
            action={<Button variant="accent" onClick={() => navigate('/projects')}>Create first project</Button>} />
        )}

        {!sumLoading && !sumError && summaries?.length > 0 && (
          <div className="db-proj-grid">
            {summaries.map((p, i) => (
              <ProjectCard key={p.Id} project={p} index={i} navigate={navigate} />
            ))}
          </div>
        )}
      </section>

      {/* ── My Tasks ─────────────────────────────────────────────────────── */}
      <section className="db-section">
        <div className="db-section__header">
          <h2 className="db-section__title">My Tasks</h2>
          <select
            className="db-owner-select"
            value={selectedOwner}
            onChange={e => setSelectedOwner(e.target.value)}
          >
            <option value="">— Select a Task Owner —</option>
            {owners?.map(o => (
              <option key={o.Id} value={o.Id}>{o.Name}</option>
            ))}
          </select>
        </div>

        {!selectedOwner && (
          <div className="db-owner-prompt">
            <span>👤</span>
            <p>Select a Task Owner above to see their tasks across all projects.</p>
          </div>
        )}

        {selectedOwner && myLoading && (
          <div className="db-my-loading">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 64, borderRadius: 8, marginBottom: 8 }} />
            ))}
          </div>
        )}

        {selectedOwner && !myLoading && myTasks?.length === 0 && (
          <EmptyState icon="✅" title="All caught up!"
            description="No incomplete tasks assigned to this owner." />
        )}

        {selectedOwner && !myLoading && myTasks?.length > 0 && (
          <div className="db-my-table-wrap">
            <table className="db-my-table">
              <thead>
                <tr>
                  <th className="db-th">Code</th>
                  <th className="db-th">Task</th>
                  <th className="db-th">Project</th>
                  <th className="db-th">Stage</th>
                  <th className="db-th">Start Date</th>
                  <th className="db-th">Est. Days</th>
                  <th className="db-th">Status</th>
                  <th className="db-th"></th>
                </tr>
              </thead>
              <tbody>
                {myTasks.map((t, i) => (
                  <MyTaskRow key={t.Id} task={t} index={i}
                    onClick={() => navigate(`/projects/${t.ProjectId}/tasks/${t.Id}`)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  );
}

// ── ProjectCard ───────────────────────────────────────────────────────────────
function ProjectCard({ project: p, index, navigate }) {
  const pct   = p.PercentComplete;
  const color = pct < 30 ? 'red' : pct <= 70 ? 'yellow' : 'green';

  const statusLabel = pct < 30 ? 'Early stage' : pct <= 70 ? 'In progress' : 'Near complete';

  return (
    <div className={`db-proj-card animate-fade-up`}
      style={{ animationDelay: `${index * 0.06}s` }}>

      {/* Header */}
      <div className="db-proj-card__header">
        <div className="db-proj-card__avatar">
          {p.Name.charAt(0).toUpperCase()}
        </div>
        <div className="db-proj-card__info">
          <h3 className="db-proj-card__name">{p.Name}</h3>
          {p.Address && <p className="db-proj-card__addr">📍 {p.Address}</p>}
        </div>
      </div>

      {/* Progress */}
      <div className="db-proj-card__progress">
        <div className="db-proj-progress__meta">
          <span className={`db-proj-badge db-proj-badge--${color}`}>{statusLabel}</span>
          <span className="db-proj-progress__pct">{pct}%</span>
        </div>
        <div className="db-proj-progress__track">
          <div className={`db-proj-progress__fill db-proj-progress__fill--${color}`}
            style={{ width: `${pct}%` }} />
        </div>
        <p className="db-proj-progress__fraction">
          {p.CompletedTasks} / {p.TotalTasks} tasks completed
        </p>
      </div>

      {/* Stats row */}
      <div className="db-proj-card__stats">
        <Stat icon="▶" label="In Progress" val={p.InProgressTasks}  cls="" />
        <Stat icon="✦" label="Unblocked"   val={p.UnblockedTasks}   cls="green" />
        {p.DelayedTasks > 0 && (
          <Stat icon="⚠" label="Delayed" val={p.DelayedTasks} cls="red" />
        )}
        {p.LastActivity && (
          <div className="db-proj-stat">
            <span className="db-proj-stat__icon">📅</span>
            <span className="db-proj-stat__lbl">Last activity</span>
            <span className="db-proj-stat__val">{fmtDate(p.LastActivity)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="db-proj-card__actions">
        <Button variant="secondary" size="sm"
          onClick={() => navigate(`/projects/${p.Id}/tasks`)}>
          ☰ Tasks
        </Button>
        <Button variant="primary" size="sm"
          onClick={() => navigate(`/projects/${p.Id}/next-tasks`)}>
          ▶ Next Tasks
        </Button>
      </div>
    </div>
  );
}

function Stat({ icon, label, val, cls }) {
  return (
    <div className="db-proj-stat">
      <span className="db-proj-stat__icon">{icon}</span>
      <span className="db-proj-stat__lbl">{label}</span>
      <span className={`db-proj-stat__val ${cls ? `db-proj-stat__val--${cls}` : ''}`}>{val}</span>
    </div>
  );
}

// ── MyTaskRow ─────────────────────────────────────────────────────────────────
function MyTaskRow({ task: t, index, onClick }) {
  const isDelayed   = t.DelayDays > 0;
  const isUnblocked = t.IsUnblocked;
  const isStarted   = !!t.OwnerStartDate;

  return (
    <tr className={`db-my-row ${index % 2 === 0 ? 'db-my-row--even' : 'db-my-row--odd'} ${isDelayed ? 'db-my-row--delayed' : ''}`}>
      <td className="db-td">
        <span className="db-my-code">{t.ExcelCode ?? '—'}</span>
      </td>
      <td className="db-td db-td--name">{t.TaskName}</td>
      <td className="db-td db-td--sub">{t.ProjectName}</td>
      <td className="db-td db-td--sub">{t.ProjectStage ?? '—'}</td>
      <td className="db-td db-td--sub">{fmtDate(t.OwnerStartDate)}</td>
      <td className="db-td db-td--sub">{t.TypicalTimelineDays != null ? `${t.TypicalTimelineDays}d` : '—'}</td>
      <td className="db-td">
        {isDelayed ? (
          <span className="db-my-chip db-my-chip--delayed">⚠ {t.DelayDays}d late</span>
        ) : isStarted ? (
          <span className="db-my-chip db-my-chip--progress">▶ In Progress</span>
        ) : isUnblocked ? (
          <span className="db-my-chip db-my-chip--ready">✦ Ready</span>
        ) : (
          <span className="db-my-chip db-my-chip--blocked">⏳ Blocked</span>
        )}
      </td>
      <td className="db-td">
        <button className="db-my-link" onClick={onClick}>Details →</button>
      </td>
    </tr>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────────────────
function ProjectSkeletons() {
  return (
    <div className="db-proj-grid">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="db-proj-card">
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 12, width: '40%' }} />
            </div>
          </div>
          <div className="skeleton" style={{ height: 6, borderRadius: 100, marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="skeleton" style={{ height: 30, flex: 1, borderRadius: 6 }} />
            <div className="skeleton" style={{ height: 30, flex: 1, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
