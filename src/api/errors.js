import api from './axios';

export const getApiErrorMessage = (error, fallback) => {
  const response = error.response;
  if (response) {
    const message = response.data?.message;
    if (typeof message === 'string' && message.trim()) return message;

    const validationMessage = Object.values(response.data?.errors || {})
      .flat()
      .find((item) => typeof item === 'string');
    if (validationMessage) return validationMessage;

    if (response.status === 401) return 'Your session has expired. Please sign in again.';
    if (response.status === 403) return 'You are not authorized to perform this action.';
    return `${fallback} (HTTP ${response.status})`;
  }

  if (error.request || error.code === 'ERR_NETWORK') {
    return `Could not reach the Laravel API at ${api.defaults.baseURL}. Check the API URL, backend availability, and backend CORS settings.`;
  }

  return error.message || fallback;
};
