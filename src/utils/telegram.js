let initialized = false;

export const getTelegramWebApp = () => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    const webApp = window.Telegram.WebApp;
    if (!initialized) {
      webApp.ready();
      webApp.expand();
      initialized = true;
    }
    return webApp;
  }
  return null;
};

export const getInitData = () => {
  const webApp = getTelegramWebApp();
  return webApp?.initData || '';
};

export const getTelegramUser = () => {
  const webApp = getTelegramWebApp();

  if (webApp?.initDataUnsafe?.user) {
    return {
      first_name: webApp.initDataUnsafe.user.first_name,
      last_name: webApp.initDataUnsafe.user.last_name || '',
      username: webApp.initDataUnsafe.user.username || '',
      initData: webApp.initData,
    };
  }

  return null;
};

export const closeTelegramApp = () => {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.close();
  }
};