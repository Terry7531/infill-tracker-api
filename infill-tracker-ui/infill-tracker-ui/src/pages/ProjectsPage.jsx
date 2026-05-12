import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import PageShell from '../components/PageShell';
import Button from '../components/Button';
import ProgressBar from '../components/ProgressBar';
import { ErrorMessage, EmptyState, LoadingGrid } from '../components/Feedback';
import CreateProjectModal from '../components/CreateProjectModal';
import './ProjectsPage.css';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

  const { data: projects, loading, error, refetch } = useApi(
    () => api.projects.list(),
    []
  );

  const handleCreated = () => {
    setShowCreate(false);
    refetch();
  };

  return (
    <>
      <PageShell
        title="Projects"
        subtitle={
          projects
            ? `${projects.length} active project${projects.length !== 1 ? 's' : ''}`
            : undefined
        }
        actions={
          <Button
            variant="accent"
            icon="+"
            onClick={() => setShowCreate(true)}
          >
            New Project
          </Button>
        }
      >
        {loading && <LoadingGrid count={3} />}

        {error && <ErrorMessage message={error} />}

        {!loading && !error && projects?.length === 0 && (
          <EmptyState
            icon="🏗️"
            title="No projects yet"
            description="Create your first project to get started. Tasks are seeded automatically."
            action={
              <Button variant="accent" onClick={() => setShowCreate(true)}>
                Create first project
              </Button>
            }
          />
        )}

        {!loading && !error && projects?.length > 0 && (
          <div className="projects-grid">
            {projects.map((project, i) => (
              <ProjectCard
                key={project.Id}
                project={project}
                index={i}
                onTaskList={() => navigate(`/projects/${project.Id}/tasks`)}
                onNextTask={() => navigate(`/projects/${project.Id}/next-tasks`)}
              />
            ))}
          </div>
        )}
      </PageShell>

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}

// ── ProjectCard ───────────────────────────────────────────────────────────────
function ProjectCard({ project, index, onTaskList, onNextTask }) {
  const total = project.TaskCount ?? 0;

  // Fetch live task data to compute real completion %
  const { data: tasks } = useApi(
    () => api.tasks.listByProject(project.Id),
    [project.Id]
  );

  const done    = tasks ? tasks.filter(t => t.IsCompleted).length : 0;
  const percent = total > 0 ? (done / total) * 100 : 0;

  return (
    <article
      className="project-card animate-fade-up"
      style={{ animationDelay: `${index * 0.07}s` }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="project-card__header">
        <div className="project-card__avatar">
          {project.Name.charAt(0).toUpperCase()}
        </div>
        <div className="project-card__titles">
          <h2 className="project-card__name">{project.Name}</h2>
          {project.Address && (
            <p className="project-card__address">
              <span className="project-card__address-icon">📍</span>
              {project.Address}
            </p>
          )}
        </div>
      </div>

      {/* ── Progress ────────────────────────────────────────────────────── */}
      <div className="project-card__progress">
        {tasks
          ? <ProgressBar percent={percent} total={total} done={done} />
          : <div className="skeleton" style={{ height: 42 }} />
        }
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="project-card__actions">
        <Button
          variant="secondary"
          size="sm"
          icon="☰"
          onClick={onTaskList}
        >
          Task List
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon="▶"
          onClick={onNextTask}
        >
          Next Task
        </Button>
      </div>
    </article>
  );
}
