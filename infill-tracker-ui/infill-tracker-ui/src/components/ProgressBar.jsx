import './ProgressBar.css';

/**
 * ProgressBar
 * @param {number} percent  0–100
 * @param {number} total    total task count
 * @param {number} done     completed task count
 */
export default function ProgressBar({ percent, total, done }) {
  const clamped = Math.min(100, Math.max(0, percent));

  const color =
    clamped < 30  ? 'red'    :
    clamped <= 70 ? 'yellow' :
                    'green';

  const label =
    color === 'red'    ? 'Early stage'   :
    color === 'yellow' ? 'In progress'   :
                         'Near complete';

  return (
    <div className="progress">
      <div className="progress__meta">
        <span className={`progress__badge progress__badge--${color}`}>
          {label}
        </span>
        <span className="progress__fraction">
          {done} / {total} tasks
        </span>
      </div>
      <div className="progress__track" role="progressbar"
           aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`progress__fill progress__fill--${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="progress__pct">{Math.round(clamped)}%</span>
    </div>
  );
}
