import { useParams, useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell';
import Button from '../components/Button';

// Placeholder kept for any future stub pages
export function NextTaskPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  return (
    <PageShell title="Not Found" actions={
      <Button variant="ghost" onClick={() => navigate('/projects')}>← Projects</Button>
    }>
      <p style={{ color: 'var(--text-muted)' }}>Page not found.</p>
    </PageShell>
  );
}
