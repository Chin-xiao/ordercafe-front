
export const getTelegramWebApp = () => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    const webApp = window.Telegram.WebApp;
    webApp.ready();
    webApp.expand(); // Make the Mini App full height
    return webApp;
  }
  return null;
};

export const getInitData = () => {
  const webApp = getTelegramWebApp();
  // Fallback for local browser testing if needed
  return webApp?.initData || 'query_id=AAH...&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Sokheng%22%7D&auth_date=1727760000&hash=abc...';
};