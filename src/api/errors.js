import api from './axios';

export const getApiErrorMessage = (error, fallback) => {
  const response = error.response;
  if (response) {
    const message = response.data?.message;
    const validationMessage = Object.values(response.data?.errors || {})
      .flat()
      .find((item) => typeof item === 'string');

    if (response.status === 401) {
      return 'Authentication failed (401). Sign in again or reopen the Mini App from Telegram.';
    }
    if (response.status === 403) {
      return 'The server denied this action (403). Check your account permissions and Telegram verification.';
    }
    if (response.status === 404) {
      return message || 'The requested resource was not found (404). Check that a current order session exists.';
    }
    if (response.status === 422) {
      return validationMessage || message || 'The server rejected the submitted data (422). Check the required fields.';
    }
    if (response.status >= 500) {
      return message || `The Laravel API encountered a server error (HTTP ${response.status}). Please try again later.`;
    }
    if (typeof message === 'string' && message.trim()) return message;
    if (validationMessage) return validationMessage;
    return `${fallback} (HTTP ${response.status})`;
  }

  if (error.request || error.code === 'ERR_NETWORK') {
    return `Could not reach the Laravel API at ${api.defaults.baseURL}. Check the API URL, backend availability, and backend CORS settings.`;
  }

  return error.message || fallback;
};
