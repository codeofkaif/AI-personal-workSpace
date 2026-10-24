/**
 * API Client — AI Personal Workspace
 * Centralized fetch wrapper with JWT interceptors and RBAC role APIs
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const RAG_URL  = 'http://localhost:8000';

// ── Token Management ─────────────────────────────────────────────────────────
export const tokenManager = {
  get:   () => localStorage.getItem('auth_token'),
  set:   (t) => localStorage.setItem('auth_token', t),
  clear: () => localStorage.removeItem('auth_token'),
};

// ── Fetch wrapper with auth headers ──────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = tokenManager.get();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    tokenManager.clear();
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
      window.location.href = '/login';
    }
    return;
  }

  if (res.status === 403) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || 'Access Denied: You do not have permission to perform this action.');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  if (res.status === 204) return null;
  return res.json();
}

// ── Multipart upload helper (no Content-Type header — browser sets boundary) ─
async function apiUpload(path, formData) {
  const token = tokenManager.get();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (res.status === 401) {
    tokenManager.clear();
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
      window.location.href = '/login';
    }
    return;
  }

  if (res.status === 403) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || 'Access Denied: You do not have permission for this upload.');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || error.message || 'Upload failed');
  }

  return res.json();
}

// ── Auth API ──────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login:    (data) => apiFetch('/api/auth/login',    { method: 'POST', body: JSON.stringify(data) }),
  me:       ()     => apiFetch('/api/auth/me'),
};

// ── Admin API (Role Protected) ────────────────────────────────────────────────
export const adminApi = {
  getStats: () => apiFetch('/api/admin/stats'),
  getPlacementCategories: (dept = '', cat = '') => {
    const params = new URLSearchParams();
    if (dept) params.append('department', dept);
    if (cat) params.append('category', cat);
    return apiFetch(`/api/admin/placement-categories?${params.toString()}`);
  },
  getActivities: (limit = 50) => apiFetch(`/api/admin/activities?limit=${limit}`),
  getUsers: () => apiFetch('/api/admin/users'),
  updateUserRole: (userId, role) =>
    apiFetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
};

// ── Dean API (Executive Academic Oversight) ───────────────────────────────────
export const deanApi = {
  getOverview: () => apiFetch('/api/dean/overview'),
};

// ── HOD API (Department Portal) ───────────────────────────────────────────────
export const hodApi = {
  getOverview: () => apiFetch('/api/hod/overview'),
};

// ── Notices API (Hierarchical Notice Board) ──────────────────────────────────
export const noticesApi = {
  getAll: () => apiFetch('/api/notices/all'),
  getUserNotices: () => apiFetch('/api/notices'),
  create: (data) =>
    apiFetch('/api/notices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (id) => apiFetch(`/api/notices/${id}`, { method: 'DELETE' }),
};

// ── Profile API (Strict Privacy & Security) ───────────────────────────────────
export const profileApi = {
  getMe: () => apiFetch('/api/profile/me'),
  updateMe: (data) =>
    apiFetch('/api/profile/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getStudentSecure: (studentId) => apiFetch(`/api/profile/student/${studentId}`),
};

// ── Activity Logging ──────────────────────────────────────────────────────────
export const activitiesApi = {
  log: (action, details) =>
    apiFetch('/api/activities/log', {
      method: 'POST',
      body: JSON.stringify({ action, details }),
    }).catch(() => {}),
};

// ── Notes API ─────────────────────────────────────────────────────────────────
export const notesApi = {
  getAll: ()           => apiFetch('/api/notes'),
  create: (data)       => apiFetch('/api/notes',     { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data)   => apiFetch(`/api/notes/${id}`, { method: 'PUT',  body: JSON.stringify(data) }),
  delete: (id)         => apiFetch(`/api/notes/${id}`, { method: 'DELETE' }),
};

// ── Tasks API ─────────────────────────────────────────────────────────────────
export const tasksApi = {
  getAll:       ()         => apiFetch('/api/tasks'),
  create:       (data)     => apiFetch('/api/tasks',              { method: 'POST',  body: JSON.stringify(data) }),
  update:       (id, data) => apiFetch(`/api/tasks/${id}`,         { method: 'PUT',   body: JSON.stringify(data) }),
  markComplete: (id)       => apiFetch(`/api/tasks/${id}/complete`, { method: 'PATCH' }),
  delete:       (id)       => apiFetch(`/api/tasks/${id}`,         { method: 'DELETE' }),
};

// ── Documents API ─────────────────────────────────────────────────────────────
export const documentsApi = {
  getAll: () => apiFetch('/api/documents'),
  getCollegeDocs: () => apiFetch('/api/documents/college'),
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiUpload('/api/documents/upload', fd);
  },
  uploadCollege: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiUpload('/api/documents/upload/college', fd);
  },
  delete: (id) => apiFetch(`/api/documents/${id}`, { method: 'DELETE' }),
};

// ── AI / RAG API ──────────────────────────────────────────────────────────────
export const aiApi = {
  chat: (question, topK = 5, scope = 'College + Personal') =>
    apiFetch('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ question, topK, scope }),
    }),
  status: () => apiFetch('/api/ai/status'),
  ragHealth: () =>
    fetch(`${RAG_URL}/health`).then((r) => r.json()).catch(() => ({ status: 'offline' })),
};

// ── Conversations API ─────────────────────────────────────────────────────────
export const conversationsApi = {
  getAll:      ()   => apiFetch('/api/conversations'),
  create:      ()   => apiFetch('/api/conversations', { method: 'POST' }),
  getMessages: (id) => apiFetch(`/api/conversations/${id}`),
};

// ── Health API ────────────────────────────────────────────────────────────────
export const healthApi = {
  check: () => fetch(`${BASE_URL}/api/health`).then((r) => r.json()).catch(() => ({ status: 'DOWN', database: { status: 'DOWN' }, ragService: { status: 'DOWN' } })),
};

// ── Colleges API ──────────────────────────────────────────────────────────────
export const collegesApi = {
  getAll: () => apiFetch('/api/colleges'),
};

export default apiFetch;
