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
  return webApp?.initData || '';
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

  return null;
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