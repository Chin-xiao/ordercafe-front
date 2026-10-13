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

export const getOrderSessionLaunch = () => {
  const rawStartParam = getTelegramWebApp()?.initDataUnsafe?.start_param;
  if (rawStartParam === undefined || rawStartParam === null || rawStartParam === '') {
    return { startParam: '', sessionId: null, error: '' };
  }

  if (typeof rawStartParam !== 'string' || rawStartParam.length > 128) {
    return {
      startParam: '',
      sessionId: null,
      error: 'This Telegram launch link contains an invalid order session parameter.',
    };
  }

  const startParam = rawStartParam;
  const match = /^order_([1-9]\d*)$/.exec(startParam);
  if (!match) {
    return {
      startParam,
      sessionId: null,
      error: 'This Telegram launch link does not contain a valid order session.',
    };
  }

  const sessionId = Number(match[1]);
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0) {
    return {
      startParam,
      sessionId: null,
      error: 'This Telegram launch link contains an invalid order session identifier.',
    };
  }

  return { startParam, sessionId, error: '' };
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