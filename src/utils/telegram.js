/**
 * Initialize and get the Telegram WebApp instance.
 */
export const getTelegramWebApp = () => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    const webApp = window.Telegram.WebApp;
    webApp.ready();
    webApp.expand(); // Expands the Mini App to full height
    return webApp;
  }
  return null;
};

/**
 * Retrieve Telegram initData for backend authentication/verification.
 * Includes a development fallback for local browser testing.
 */
export const getInitData = () => {
  const webApp = getTelegramWebApp();
  
  // Return actual Telegram initData if running inside the Telegram app
  if (webApp && webApp.initData) {
    return webApp.initData;
  }

  // Fallback for local browser development testing outside Telegram
  return 'query_id=AAH...&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Sokheng%22%7D&auth_date=1727760000&hash=abc...';
};

/**
 * Extract authenticated user details from Telegram WebApp safely.
 */
export const getTelegramUser = () => {
  const webApp = getTelegramWebApp();

  if (webApp?.initDataUnsafe?.user) {
    return {
      id: webApp.initDataUnsafe.user.id,
      first_name: webApp.initDataUnsafe.user.first_name,
      last_name: webApp.initDataUnsafe.user.last_name || '',
      username: webApp.initDataUnsafe.user.username || '',
      initData: webApp.initData,
    };
  }

  // Mock user fallback for local browser testing
  return {
    id: 123456789,
    first_name: 'Sokheng',
    last_name: 'Dev',
    username: 'sokheng_dev',
    initData: getInitData(),
  };
};

/**
 * Close the Telegram Mini App programmatically.
 */
export const closeTelegramApp = () => {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.close();
  }
};