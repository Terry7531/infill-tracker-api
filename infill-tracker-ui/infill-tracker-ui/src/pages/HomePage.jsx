import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import './HomePage.css';

export default function HomePage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();
  const authRequired = location.state?.authRequired;

  return (
    <div className="home">
      {/* ── Decorative background grid ─────────────────────────────────── */}
      <div className="home__bg-grid" aria-hidden="true" />

      <div className="home__inner">
        {/* ── Auth required notice ───────────────────────────────────────── */}
        {authRequired && !user && (
          <div className="home-auth-notice animate-fade-up">
            <span>🔒</span>
            <span>Please sign in to access InfillTracker.</span>
            <button className="home-auth-notice__btn"
              onClick={() => navigate('/signin')}>
              Sign In →
            </button>
          </div>
        )}

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="home__hero animate-fade-up">
          <div className="home__eyebrow">
            <span className="home__eyebrow-dot" />
            Construction Project Management
          </div>

          <h1 className="home__headline">
            Every task.<br />
            Every dependency.<br />
            <em>Always on track.</em>
          </h1>

          <p className="home__sub">
            InfillTracker gives your team a clear view of infill construction
            progress — from demolition permits through final inspections —
            with automatic task sequencing built in from day one.
          </p>

          <div className="home__cta">
            <Button
              variant="accent"
              size="lg"
              icon="→"
              onClick={() => navigate('/projects')}
            >
              View Projects
            </Button>
          </div>
        </section>

        {/* ── Stats strip ───────────────────────────────────────────────── */}
        <div className="home__stats animate-fade-up" style={{ animationDelay: '0.15s' }}>
          {[
            { value: '151', label: 'Template Tasks' },
            { value: '6',   label: 'Project Stages'  },
            { value: '∞',   label: 'Projects'         },
          ].map(({ value, label }) => (
            <div key={label} className="home__stat">
              <span className="home__stat-value">{value}</span>
              <span className="home__stat-label">{label}</span>
            </div>
          ))}
        </div>

        {/* ── Stage pills ───────────────────────────────────────────────── */}
        <div className="home__stages animate-fade-up" style={{ animationDelay: '0.25s' }}>
          {[
            'Pre Development',
            'Acquisition',
            'Financing',
            'Construction',
            'Inspections',
            'Utilities',
          ].map((stage, i) => (
            <span key={stage} className="home__stage-pill" style={{ animationDelay: `${0.3 + i * 0.05}s` }}>
              <span className="home__stage-num">{String(i + 1).padStart(2, '0')}</span>
              {stage}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
