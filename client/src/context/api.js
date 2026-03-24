import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const auth = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me')
};

export const workspaces = {
  getAll: () => api.get('/workspaces'),
  create: (data) => api.post('/workspaces', data),
  getMembers: (id) => api.get(`/workspaces/${id}/members`),
  addMember: (id, data) => api.post(`/workspaces/${id}/members`, data),
  getAnalytics: (id) => api.get(`/workspaces/${id}/analytics`)
};

export const projects = {
  getAll: (workspaceId) => api.get(`/workspaces/${workspaceId}/projects`),
  create: (workspaceId, data) => api.post(`/workspaces/${workspaceId}/projects`, data),
  delete: (id) => api.delete(`/projects/${id}`)
};

export const columns = {
  getAll: (projectId) => api.get(`/projects/${projectId}/columns`),
  create: (projectId, data) => api.post(`/projects/${projectId}/columns`, data),
  update: (id, data) => api.put(`/columns/${id}`, data),
  delete: (id) => api.delete(`/columns/${id}`)
};

export const tasks = {
  getByColumn: (columnId) => api.get(`/columns/${columnId}/tasks`),
  create: (columnId, data) => api.post(`/columns/${columnId}/tasks`, data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
  addAssignee: (taskId, userId) => api.post(`/tasks/${taskId}/assignees`, { userId }),
  removeAssignee: (taskId, userId) => api.delete(`/tasks/${taskId}/assignees/${userId}`),
  getComments: (taskId) => api.get(`/tasks/${taskId}/comments`),
  addComment: (taskId, content) => api.post(`/tasks/${taskId}/comments`, { content })
};

export default api;