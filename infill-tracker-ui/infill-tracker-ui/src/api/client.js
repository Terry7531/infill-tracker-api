// Dev: Vite proxies /api to localhost. Production: direct Railway API URL.
const IS_DEV = import.meta.env.DEV;
const BASE   = IS_DEV ? '/api' : 'https://infill-tracker-api-production.up.railway.app/api';

// In-memory token store — never written to localStorage (XSS safe)
let _token = null;

export function setAuthToken(token) { _token = token; }
export function clearAuthToken()    { _token = null;  }

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Send JWT as Bearer token (works cross-domain, no cookie issues)
  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    headers,
    credentials: 'include',   // still send cookies for local dev
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    signIn:         (email, password) => request('/auth/signin', { method: 'POST', body: JSON.stringify({ Email: email, Password: password }) }),
    signOut:        ()                => request('/auth/signout', { method: 'POST' }),
    me:             ()                => request('/auth/me'),
    changePassword: (current, newPwd) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ CurrentPassword: current, NewPassword: newPwd }) }),
  },

  admin: {
    listUsers:     ()        => request('/admin/users'),
    createUser:    (dto)     => request('/admin/users', { method: 'POST', body: JSON.stringify(dto) }),
    resetPassword: (id, dto) => request(`/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify(dto) }),
    deleteUser:    (id)      => request(`/admin/users/${id}`, { method: 'DELETE' }),
  },

  dashboard: {
    summary:  ()        => request('/dashboard/summary'),
    myTasks:  (ownerId) => request(`/dashboard/my-tasks?ownerId=${ownerId}`),
    owners:   ()        => request('/dashboard/owners'),
  },

  notifications: {
    send: ()          => request('/notifications/send', { method: 'POST' }),
    logs: (take = 50) => request(`/notifications/logs?take=${take}`),
  },

  projects: {
    list:   ()        => request('/projects'),
    get:    (id)      => request(`/projects/${id}`),
    create: (dto)     => request('/projects', { method: 'POST', body: JSON.stringify(dto) }),
    update: (id, dto) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),
    delete: (id)      => request(`/projects/${id}`, { method: 'DELETE' }),
  },

  tasks: {
    listByProject:   (projectId) => request(`/tasks/project/${projectId}`),
    listUnblocked:   (projectId) => request(`/tasks/project/${projectId}/unblocked`),
    get:             (id)        => request(`/tasks/${id}`),
    create:          (dto)       => request('/tasks', { method: 'POST', body: JSON.stringify(dto) }),
    update:          (id, dto)   => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),
    start:           (id)        => request(`/tasks/${id}/start`,        { method: 'PATCH' }),
    undoStart:       (id)        => request(`/tasks/${id}/undo-start`,   { method: 'PATCH' }),
    markComplete:    (id)        => request(`/tasks/${id}/complete`,     { method: 'PATCH' }),
    undoComplete:    (id)        => request(`/tasks/${id}/undo-complete`,{ method: 'PATCH' }),
    delete:          (id)        => request(`/tasks/${id}`, { method: 'DELETE' }),
    getDependencies: (id)        => request(`/tasks/${id}/dependencies`),
    getDependents:   (id)        => request(`/tasks/${id}/dependents`),
    addDependency:   (id, dto)   => request(`/tasks/${id}/dependencies`, { method: 'POST', body: JSON.stringify(dto) }),
    removeDependency:(id, depId) => request(`/tasks/${id}/dependencies/${depId}`, { method: 'DELETE' }),
  },

  taskOwners: {
    list:   ()        => request('/taskowners'),
    get:    (id)      => request(`/taskowners/${id}`),
    create: (dto)     => request('/taskowners', { method: 'POST', body: JSON.stringify(dto) }),
    update: (id, dto) => request(`/taskowners/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),
    delete: (id)      => request(`/taskowners/${id}`, { method: 'DELETE' }),
  },

  vendors: {
    list:   ()        => request('/vendors'),
    get:    (id)      => request(`/vendors/${id}`),
    create: (dto)     => request('/vendors', { method: 'POST', body: JSON.stringify(dto) }),
    update: (id, dto) => request(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),
    delete: (id)      => request(`/vendors/${id}`, { method: 'DELETE' }),
  },
};
