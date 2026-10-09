export const unwrapApiData = (response) => response?.data?.data ?? response?.data ?? null;

export const getSessionStatus = (session, now = Date.now()) => {
  const status = String(session?.status || '').toUpperCase();
  const expiresAt = session?.expires_at ? new Date(session.expires_at).getTime() : NaN;

  if (status === 'OPEN' && Number.isFinite(expiresAt) && expiresAt <= now) {
    return 'EXPIRED';
  }

  return status || 'UNKNOWN';
};

export const isOrderSessionOpen = (session, now = Date.now()) => {
  const expiresAt = session?.expires_at ? new Date(session.expires_at).getTime() : NaN;
  return (
    String(session?.status || '').toUpperCase() === 'OPEN' &&
    Number.isFinite(expiresAt) &&
    expiresAt > now
  );
};

export const formatDateTime = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
};

export const formatRemainingTime = (expiresAt, now = Date.now()) => {
  const remaining = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return '0m 0s';

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    days > 0 ? `${days}d` : '',
    hours > 0 || days > 0 ? `${hours}h` : '',
    `${minutes}m`,
    `${seconds}s`,
  ].filter(Boolean).join(' ');
};
