import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? 'http://localhost:8000/api' : '');

if (!baseURL) {
  throw new Error('VITE_API_BASE_URL must be configured for production builds.');
}

const api = axios.create({
  baseURL: baseURL.replace(/\/+$/, ''),
  headers: {
    'Accept': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const telegramInitData = window.Telegram?.WebApp?.initData;
  if (telegramInitData) {
    config.headers['X-Telegram-Init-Data'] = telegramInitData;
  }

  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use((response) => response, (error) => {
  const isAdminResource = /^\/?admin\/(?!login(?:\/|$)|register(?:\/|$))/.test(error.config?.url || '');
  if (error.response?.status === 401 && isAdminResource) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('token');
    if (window.location.pathname.startsWith('/admin')) {
      window.location.replace('/admin/login?reason=session-expired');
    }
  }

  return Promise.reject(error);
});

export default api;