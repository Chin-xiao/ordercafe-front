import axios from 'axios';
import { getInitData } from '../utils/telegram';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    'Accept': 'application/json',
  },
});

// Automatically inject either Admin Sanctum Token or Telegram Init-Data
api.interceptors.request.use((config) => {
  // Check if an admin token exists in localStorage (used by the admin panel)
  const adminToken = localStorage.getItem('token'); // Adjust key if your app uses something else like 'admin_token'
  
  if (adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  } else {
    // Otherwise, fallback to Telegram InitData for customer Mini App requests
    const initData = getInitData();
    if (initData) {
      config.headers['X-Telegram-Init-Data'] = initData;
    }
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;