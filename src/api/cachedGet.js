// src/api/cachedGet.js
// 1) Shares one request between identical GETs that happen at the same time
//    (React StrictMode runs effects twice in dev, which doubled every request).
// 2) Remembers the last response, so a page can show it instantly on the next visit
//    while fresh data loads quietly in the background.
import api from './axios';

const cache = new Map();    // url -> last axios response
const inflight = new Map(); // url -> pending promise

export const peek = (url) => cache.get(url);

// Forget one URL, e.g. after a POST/PUT/DELETE changed that data
export const invalidate = (url) => cache.delete(url);

export function cachedGet(url) {
  if (inflight.has(url)) return inflight.get(url);
  const request = api
    .get(url)
    .then((res) => {
      cache.set(url, res);
      return res;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, request);
  return request;
}

// Call after logout so the next user never sees someone else's cached data
export const clearCache = () => cache.clear();