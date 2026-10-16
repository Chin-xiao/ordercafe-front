import api from './axios';

const MENU_CACHE_TTL_MS = 15000;

let cachedMenu = null;
let cacheExpiresAt = 0;
let pendingRequest = null;

const isCanceled = () => new DOMException('Menu request canceled.', 'AbortError');

const requestMenu = () => {
  const controller = new AbortController();
  const request = {
    controller,
    consumers: new Set(),
    settled: false,
    promise: null,
  };

  request.promise = Promise.all([
    api.get('/mini-app/categories', { signal: controller.signal }),
    api.get('/mini-app/products', { signal: controller.signal }),
  ]).then(([categoryResponse, productResponse]) => {
    const categories = categoryResponse.data?.data ?? categoryResponse.data;
    const products = productResponse.data?.data ?? productResponse.data;
    const sugarOptions = productResponse.data?.sugar_percent_options;

    if (
      !Array.isArray(categories) ||
      !Array.isArray(products) ||
      !Array.isArray(sugarOptions) ||
      sugarOptions.length === 0 ||
      sugarOptions.some((option) => !Number.isInteger(Number(option)))
    ) {
      throw new Error('The API returned an invalid menu response.');
    }

    const menu = { categories, products, sugarOptions: sugarOptions.map(Number) };
    cachedMenu = menu;
    cacheExpiresAt = Date.now() + MENU_CACHE_TTL_MS;
    return menu;
  });

  pendingRequest = request;
  const clearPending = () => {
    request.settled = true;
    if (pendingRequest === request) pendingRequest = null;
  };
  request.promise.then(clearPending, clearPending);
  return request;
};

export const invalidateMenuCache = () => {
  cachedMenu = null;
  cacheExpiresAt = 0;
};

export const getMenuData = (signal, { force = false } = {}) => {
  if (signal?.aborted) return Promise.reject(signal.reason || isCanceled(signal));

  if (force) invalidateMenuCache();
  if (cachedMenu && Date.now() < cacheExpiresAt) return Promise.resolve(cachedMenu);

  const request = pendingRequest || requestMenu();

  return new Promise((resolve, reject) => {
    const consumer = {};
    let complete = false;

    const unsubscribe = () => {
      if (complete) return false;
      complete = true;
      signal?.removeEventListener('abort', handleAbort);
      request.consumers.delete(consumer);
      if (!request.settled && request.consumers.size === 0) {
        request.controller.abort();
        if (pendingRequest === request) pendingRequest = null;
      }
      return true;
    };

    const handleAbort = () => {
      if (unsubscribe()) reject(signal.reason || isCanceled(signal));
    };

    request.consumers.add(consumer);
    signal?.addEventListener('abort', handleAbort, { once: true });
    request.promise.then(
      (menu) => {
        if (unsubscribe()) resolve(menu);
      },
      (error) => {
        if (unsubscribe()) reject(error);
      }
    );
  });
};
