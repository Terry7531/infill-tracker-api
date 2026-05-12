import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import PageShell from '../components/PageShell';
import Button from '../components/Button';
import AddPersonModal from '../components/AddPersonModal';
import { ErrorMessage } from '../components/Feedback';
import './TaskDetailPage.css';

export default function TaskDetailPage() {
  const { projectId, taskId } = useParams();
  const navigate = useNavigate();

  const { data: task,        loading: taskLoading,   error: taskError, refetch } =
    useApi(() => api.tasks.get(Number(taskId)), [taskId]);
  const { data: ownersInit,  loading: ownersLoading } =
    useApi(() => api.taskOwners.list(), []);
  const { data: vendorsInit } =
    useApi(() => api.vendors.list(), []);

  // Local copies so we can append newly created owners/vendors instantly
  const [owners,  setOwners]  = useState(null);
  const [vendors, setVendors] = useState(null);

  useEffect(() => { if (ownersInit)  setOwners(ownersInit);  }, [ownersInit]);
  useEffect(() => { if (vendorsInit) setVendors(vendorsInit); }, [vendorsInit]);

  const [form,         setForm]         = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [saveErr,      setSaveErr]      = useState(null);
  const [saved,        setSaved]        = useState(false);
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [showAddVendor,setShowAddVendor]= useState(false);

  // Populate form when task loads
  useEffect(() => {
    if (!task) return;
    setForm({
      ProjectStage:        task.ProjectStage        ?? '',
      ToDoList:            task.ToDoList            ?? '',
      TaskOwnerId:         task.TaskOwnerId          ?? '',
      VendorId:            task.VendorId             ?? '',
      TypicalTimelineDays: task.TypicalTimelineDays  ?? '',
      OwnerStartDate:      task.OwnerStartDate        ? isoDate(task.OwnerStartDate) : '',
      FinishDate:          task.FinishDate            ? isoDate(task.FinishDate)      : '',
      TotalActualDays:     task.TotalActualDays       ?? '',
      Cost:                task.Cost                  ?? '',
      InvoiceNumber:       task.InvoiceNumber         ?? '',
      PaymentMethod:       task.PaymentMethod         ?? '',
      StorageLocation:     task.StorageLocation       ?? '',
      TemplateDocument:    task.TemplateDocument      ?? '',
      IsCompleted:         task.IsCompleted,
    });
  }, [task]);

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [field]: val }));
    setSaved(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveErr(null);
    try {
      await api.tasks.update(Number(taskId), {
        ProjectStage:        nullIfEmpty(form.ProjectStage),
        TaskName:            task.TaskName,
        ToDoList:            nullIfEmpty(form.ToDoList),
        IsCompleted:         form.IsCompleted,
        TaskOwnerId:         form.TaskOwnerId      ? Number(form.TaskOwnerId)      : null,
        VendorId:            form.VendorId         ? Number(form.VendorId)         : null,
        TypicalTimelineDays: form.TypicalTimelineDays ? Number(form.TypicalTimelineDays) : null,
        OwnerStartDate:      nullIfEmpty(form.OwnerStartDate),
        FinishDate:          nullIfEmpty(form.FinishDate),
        TotalActualDays:     form.TotalActualDays  ? Number(form.TotalActualDays)  : null,
        Cost:                form.Cost             ? parseFloat(form.Cost)         : null,
        InvoiceNumber:       nullIfEmpty(form.InvoiceNumber),
        PaymentMethod:       nullIfEmpty(form.PaymentMethod),
        StorageLocation:     nullIfEmpty(form.StorageLocation),
        TemplateDocument:    nullIfEmpty(form.TemplateDocument),
      });
      await refetch();
      setSaved(true);
    } catch (err) {
      setSaveErr(err.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  // Called when a new owner is saved — append to list and auto-select it
  const handleOwnerCreated = (newOwner) => {
    setOwners(prev => [...(prev ?? []), newOwner]);
    setForm(prev => ({ ...prev, TaskOwnerId: newOwner.Id }));
    setShowAddOwner(false);
    setSaved(false);
  };

  // Called when a new vendor is saved — append to list and auto-select it
  const handleVendorCreated = (newVendor) => {
    setVendors(prev => [...(prev ?? []), newVendor]);
    setForm(prev => ({ ...prev, VendorId: newVendor.Id }));
    setShowAddVendor(false);
    setSaved(false);
  };

  if (taskLoading || ownersLoading) return (
    <PageShell><div className="td-loading">Loading task…</div></PageShell>
  );
  if (taskError) return (
    <PageShell><ErrorMessage message={taskError} /></PageShell>
  );
  if (!task || !form) return null;

  const isStarted   = !!task.OwnerStartDate;
  const isCompleted = task.IsCompleted;

  return (
    <>
      <PageShell
        title={
          <span className="td-heading">
            <span className="td-heading__code">{task.ExcelCode ?? '—'}</span>
            <span className="td-heading__name">{task.TaskName}</span>
          </span>
        }
        subtitle={task.ProjectStage ?? undefined}
        actions={
          <Button variant="ghost" size="sm"
            onClick={() => navigate(`/projects/${projectId}/tasks`)}>
            ← Task List
          </Button>
        }
      >
        {/* ── Status badges ─────────────────────────────────────────────── */}
        <div className="td-status-row">
          <span className={`td-badge ${isStarted ? 'td-badge--started' : 'td-badge--not-started'}`}>
            {isStarted ? '▶ Started' : '○ Not started'}
          </span>
          <span className={`td-badge ${isCompleted ? 'td-badge--completed' : 'td-badge--pending'}`}>
            {isCompleted ? '✓ Completed' : '◷ Pending'}
          </span>
          {task.DependencyCount > 0 && (
            <span className="td-badge td-badge--deps">
              {task.DependencyCount} {task.DependencyCount === 1 ? 'dependency' : 'dependencies'}
            </span>
          )}
        </div>

        {/* ── Dependency / Dependent lists ─────────────────────────────── */}
        {(task.Dependencies?.length > 0 || task.Dependents?.length > 0) && (
          <div className="td-dep-section">
            {task.Dependencies?.length > 0 && (
              <div className="td-dep-group">
                <h3 className="td-dep-label">Blocked by (must complete first)</h3>
                <div className="td-dep-list">
                  {task.Dependencies.map(d => (
                    <button type="button" key={d.Id}
                      className={`td-dep-chip td-dep-chip--link ${d.IsCompleted ? 'td-dep-chip--done' : 'td-dep-chip--pending'}`}
                      onClick={() => navigate(`/projects/${projectId}/tasks/${d.Id}`)}
                      title={`Go to: ${d.TaskName}`}>
                      {d.IsCompleted ? '✓' : '○'} {d.TaskName} →
                    </button>
                  ))}
                </div>
              </div>
            )}
            {task.Dependents?.length > 0 && (
              <div className="td-dep-group">
                <h3 className="td-dep-label">Unlocks (waiting on this task)</h3>
                <div className="td-dep-list">
                  {task.Dependents.map(d => (
                    <button type="button" key={d.Id}
                      className="td-dep-chip td-dep-chip--link td-dep-chip--waiting"
                      onClick={() => navigate(`/projects/${projectId}/tasks/${d.Id}`)}
                      title={`Go to: ${d.TaskName}`}>
                      ⏳ {d.TaskName} →
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Edit form ─────────────────────────────────────────────────── */}
        <form className="td-form" onSubmit={handleSave}>

          {/* Section: Assignment */}
          <div className="td-section">
            <h2 className="td-section__title">Assignment</h2>
            <div className="td-grid td-grid--3">

              <Field label="Project Stage">
                <input className="td-input" value={form.ProjectStage}
                  onChange={set('ProjectStage')} placeholder="e.g. Construction" />
              </Field>

              {/* Task Owner: dropdown + Add button */}
              <Field label="Task Owner">
                <div className="td-select-row">
                  <select className="td-input td-select"
                    value={form.TaskOwnerId} onChange={set('TaskOwnerId')}>
                    <option value="">— Unassigned —</option>
                    {owners?.map(o => (
                      <option key={o.Id} value={o.Id}>{o.Name}</option>
                    ))}
                  </select>
                  <button type="button" className="td-add-btn"
                    onClick={() => setShowAddOwner(true)}
                    title="Add new Task Owner">
                    + Add
                  </button>
                </div>
              </Field>

              {/* Vendor: dropdown + Add button */}
              <Field label="Vendor">
                <div className="td-select-row">
                  <select className="td-input td-select"
                    value={form.VendorId} onChange={set('VendorId')}>
                    <option value="">— None —</option>
                    {vendors?.map(v => (
                      <option key={v.Id} value={v.Id}>{v.Name}</option>
                    ))}
                  </select>
                  <button type="button" className="td-add-btn"
                    onClick={() => setShowAddVendor(true)}
                    title="Add new Vendor">
                    + Add
                  </button>
                </div>
              </Field>

            </div>
          </div>

          {/* Section: Timeline */}
          <div className="td-section">
            <h2 className="td-section__title">Timeline</h2>
            <div className="td-grid td-grid--4">
              <Field label="Typical Days">
                <input className="td-input" type="number" min="0"
                  value={form.TypicalTimelineDays}
                  onChange={set('TypicalTimelineDays')} placeholder="days" />
              </Field>
              <Field label="Start Date">
                <input className="td-input" type="date"
                  value={form.OwnerStartDate} onChange={set('OwnerStartDate')} />
              </Field>
              <Field label="Finish Date">
                <input className="td-input" type="date"
                  value={form.FinishDate} onChange={set('FinishDate')} />
              </Field>
              <Field label="Actual Days">
                <input className="td-input" type="number" min="0"
                  value={form.TotalActualDays}
                  onChange={set('TotalActualDays')} placeholder="days" />
              </Field>
            </div>
          </div>

          {/* Section: Financials */}
          <div className="td-section">
            <h2 className="td-section__title">Financials</h2>
            <div className="td-grid td-grid--3">
              <Field label="Cost ($)">
                <input className="td-input" type="number" min="0" step="0.01"
                  value={form.Cost} onChange={set('Cost')} placeholder="0.00" />
              </Field>
              <Field label="Invoice Number">
                <input className="td-input" value={form.InvoiceNumber}
                  onChange={set('InvoiceNumber')} placeholder="INV-0000" />
              </Field>
              <Field label="Payment Method">
                <input className="td-input" value={form.PaymentMethod}
                  onChange={set('PaymentMethod')} placeholder="e.g. Cheque, EFT" />
              </Field>
            </div>
          </div>

          {/* Section: Documents & Notes */}
          <div className="td-section">
            <h2 className="td-section__title">Documents &amp; Notes</h2>
            <div className="td-grid td-grid--2">
              <Field label="Storage Location">
                <input className="td-input" value={form.StorageLocation}
                  onChange={set('StorageLocation')}
                  placeholder="e.g. Google Drive / Cabinet A" />
              </Field>
              <Field label="Template Document">
                <input className="td-input" value={form.TemplateDocument}
                  onChange={set('TemplateDocument')} placeholder="filename or URL" />
              </Field>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <Field label="To Do List / Notes">
                <textarea className="td-input td-textarea" rows={4}
                  value={form.ToDoList} onChange={set('ToDoList')}
                  placeholder="Checklist items, notes, or instructions…" />
              </Field>
            </div>
          </div>

          {/* Section: Status */}
          <div className="td-section">
            <h2 className="td-section__title">Status</h2>
            <label className="td-checkbox-row">
              <input type="checkbox" checked={form.IsCompleted}
                onChange={set('IsCompleted')} />
              <span>Mark as completed</span>
            </label>
          </div>

          {/* Save bar */}
          <div className="td-save-bar">
            {saveErr && <span className="td-save-bar__err">⚠ {saveErr}</span>}
            {saved   && <span className="td-save-bar__ok">✓ Saved successfully</span>}
            <Button type="submit" variant="accent" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </PageShell>

      {/* ── Add Owner modal ─────────────────────────────────────────────────── */}
      {showAddOwner && (
        <AddPersonModal
          type="owner"
          onClose={() => setShowAddOwner(false)}
          onCreated={handleOwnerCreated}
        />
      )}

      {/* ── Add Vendor modal ────────────────────────────────────────────────── */}
      {showAddVendor && (
        <AddPersonModal
          type="vendor"
          onClose={() => setShowAddVendor(false)}
          onCreated={handleVendorCreated}
        />
      )}
    </>
  );
}

// ── Small field wrapper ───────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="td-field">
      <label className="td-label">{label}</label>
      {children}
    </div>
  );
}

function nullIfEmpty(v) { return v === '' || v == null ? null : v; }
function isoDate(val)   { return String(val).slice(0, 10); }
