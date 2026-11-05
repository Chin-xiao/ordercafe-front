import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { getMenuData } from '../../api/menu';
import { getApiErrorMessage } from '../../api/errors';
import { formatRiel } from '../../utils/currency';
import { getOrderSessionLaunch, getTelegramWebApp } from '../../utils/telegram';
import { isOrderSessionOpen, unwrapApiData } from '../../utils/orderSession';
import { Icon } from '../../components/ui';

import CartCheckoutModal from './CartCheckoutModal';
import SugarSelectionModal from './SugarSelectionModal';
import SessionBanner from '../../components/miniapp/SessionBanner';
import ProductGrid from '../../components/miniapp/ProductGrid';

const SESSION_REFRESH_MS = 15000;
const INITIAL_NOW = Date.now();

// Read the cached session safely: corrupted storage must never crash the menu
function readCachedSession() {
  try {
    const cached = localStorage.getItem('cached_active_session');
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export default function MiniAppProductsPage() {
  const navigate = useNavigate();
  const launch = getOrderSessionLaunch();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [sugarOptions, setSugarOptions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionError, setSessionError] = useState('');

  // Instant load from localStorage cache
  const [session, setSession] = useState(readCachedSession);
  const [sessionVerified, setSessionVerified] = useState(() => Boolean(readCachedSession()));

  const [showCheckout, setShowCheckout] = useState(false);
  const [sugarProduct, setSugarProduct] = useState(null);
  const [sugarSelectionKey, setSugarSelectionKey] = useState(0);
  const [now, setNow] = useState(INITIAL_NOW);

  const menuRequestRef = useRef(null);
  const sessionRequestRef = useRef(null);
  const sessionSignalRef = useRef(null);
  const menuSignalRef = useRef(null);
  const hasMenuRef = useRef(false);

  const fetchSession = useCallback((signal) => {
    if (sessionRequestRef.current) return sessionRequestRef.current;
    if (launch.error) {
      setSession(null);
      setSessionError(launch.error);
      setSessionVerified(true);
      return Promise.resolve(null);
    }

    const request = (async () => {
      try {
        const response = await api.get('/mini-app/order-session/current', { signal });
        const activeSession = unwrapApiData(response);
        if (launch.sessionId && String(activeSession?.id) !== String(launch.sessionId)) {
          throw new Error(activeSession
            ? 'The server returned a different order session than the one in this Telegram link.'
            : 'The order session from this Telegram link could not be found.');
        }
        const nextSession = activeSession && typeof activeSession === 'object' ? activeSession : null;

        // Cache instantly for future reloads
        try {
          if (nextSession) {
            localStorage.setItem('cached_active_session', JSON.stringify(nextSession));
          } else {
            localStorage.removeItem('cached_active_session');
          }
        } catch { /* storage may be unavailable */ }

        setSession(nextSession);
        setSessionError('');
        setSessionVerified(true);
        setNow(Date.now());
        return nextSession;
      } catch (err) {
        if (signal?.aborted) return null;
        console.error('Failed to load the current order session', err);
        setSessionVerified(false);
        setSessionError(getApiErrorMessage(err, 'Unable to verify the order session.'));
        return null;
      }
    })();
    sessionRequestRef.current = request;
    request.finally(() => {
      if (sessionRequestRef.current === request) sessionRequestRef.current = null;
    });
    return request;
  }, [launch.error, launch.sessionId]);

  const refreshSessionStatus = useCallback(
    () => fetchSession(sessionSignalRef.current),
    [fetchSession]
  );

  const fetchMenu = useCallback((signal, force = false) => {
    if (menuRequestRef.current) return menuRequestRef.current;

    const request = (async () => {
      try {
        // Only show the loading state the first time; later refreshes happen quietly
        if (!hasMenuRef.current) setLoading(true);
        setError('');
        const menu = await getMenuData(signal, { force });
        if (signal?.aborted) return;
        setCategories(menu.categories);
        setProducts(menu.products);
        setSugarOptions(menu.sugarOptions);
        hasMenuRef.current = true;
      } catch (err) {
        if (signal?.aborted || err.code === 'ERR_CANCELED' || err.name === 'AbortError') return;
        console.error('Failed to load menu items', err);
        setError(getApiErrorMessage(err, 'Failed to load menu items.'));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    })();
    menuRequestRef.current = request;
    request.finally(() => {
      if (menuRequestRef.current === request) menuRequestRef.current = null;
    });
    return request;
  }, []);

  useEffect(() => {
    getTelegramWebApp();
    const controller = new AbortController();
    sessionSignalRef.current = controller.signal;
    menuSignalRef.current = controller.signal;

    const startup = window.setTimeout(async () => {
      await Promise.all([
        fetchMenu(controller.signal),
        fetchSession(controller.signal)
      ]);
    }, 0);

    const refresh = window.setInterval(() => fetchSession(controller.signal), SESSION_REFRESH_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        Promise.all([
          fetchMenu(controller.signal),
          fetchSession(controller.signal)
        ]);
      }
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearTimeout(startup);
      window.clearInterval(refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      controller.abort();
    };
  }, [fetchMenu, fetchSession]);

  const orderingOpen = sessionVerified && isOrderSessionOpen(session, now);
  const initDataAvailable = Boolean(window.Telegram?.WebApp?.initData);

  const handleProductClick = (product) => {
    if (product.requires_sugar) {
      setSugarSelectionKey((value) => value + 1);
      setSugarProduct(product);
    } else {
      handleAddToCart(product, null, 1);
    }
  };

  const handleAddToCart = (product, sugarPercent, quantity) => {
    const cartId = `${product.id}:${sugarPercent ?? 'nosugar'}`;
    const existing = cart.find((item) => item.cart_id === cartId);
    if (existing && existing.quantity + quantity > 100) return false;

    setCart((previousCart) => {
      if (existing) {
        return previousCart.map((item) =>
          item.cart_id === cartId ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...previousCart, {
        ...product,
        cart_id: cartId,
        sugar_percent: sugarPercent,
        quantity,
      }];
    });
    setSugarProduct(null);
    return true;
  };

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return products.filter((product) => (
      (selectedCategory === 'all' || String(product.category_id) === String(selectedCategory)) &&
      (!query || `${product.name || ''} ${product.description || ''}`.toLocaleLowerCase().includes(query))
    ));
  }, [products, search, selectedCategory]);

  const cartByProduct = useMemo(() => {
    const groups = new Map();
    cart.forEach((item) => {
      const id = String(item.id);
      const entries = groups.get(id) || [];
      entries.push(item);
      groups.set(id, entries);
    });
    return groups;
  }, [cart]);

  const totalCartPrice = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    [cart]
  );
  const totalCartItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const chipClass = (active) =>
    `min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 ${
      active ? 'bg-emerald-600 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
    }`;

  return (
    <div className={`min-h-screen bg-stone-50 text-stone-800 ${totalCartItems > 0 ? 'pb-32' : 'pb-10'}`}>
      <SessionBanner
        session={session}
        sessionVerified={sessionVerified}
        sessionError={sessionError}
        onRefresh={refreshSessionStatus}
      />

      {initDataAvailable && (
        <section aria-label="Private Telegram notifications" className="mx-4 mt-3 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Icon name="bell" size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">Private notifications: Unable to check</p>
            <p className="mt-1 text-amber-800">
              Your ordering is not affected. If you want private messages from the cafe, open the bot and voluntarily press <strong>Start</strong>.
            </p>
            <a
              className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              href="https://t.me/ahseven_bot?start=order_notifications"
              target="_blank"
              rel="noreferrer"
            >
              Enable private notifications
            </a>
          </div>
        </section>
      )}

      {error && (
        <div role="alert" className="mx-4 mt-4 flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => fetchMenu(menuSignalRef.current, true)}
            className="min-h-11 self-start rounded-xl border border-red-200 bg-white px-4 font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Retry menu
          </button>
        </div>
      )}

      <nav aria-label="Product categories" className="no-scrollbar sticky top-14 z-10 mt-3 flex gap-2 overflow-x-auto border-y border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => setSelectedCategory('all')} aria-pressed={selectedCategory === 'all'} className={chipClass(selectedCategory === 'all')}>
          All items
        </button>
        {categories.map((category) => {
          const active = String(selectedCategory) === String(category.id);
          return (
            <button key={category.id} type="button" onClick={() => setSelectedCategory(category.id)} aria-pressed={active} className={chipClass(active)}>
              {category.name}
            </button>
          );
        })}
      </nav>

      <div className="mx-auto max-w-3xl px-4 pb-2 pt-4">
        <label htmlFor="menu-search" className="sr-only">Search the menu</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
            <Icon name="search" size={18} />
          </span>
          <input
            id="menu-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search drinks and treats"
            className="h-12 w-full rounded-full border border-stone-200 bg-white pl-11 pr-4 text-sm text-stone-800 shadow-sm outline-none placeholder:text-stone-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      </div>

      <ProductGrid
        products={visibleProducts}
        loading={loading}
        error={error}
        search={search}
        orderingOpen={orderingOpen}
        cartByProduct={cartByProduct}
        onProductClick={handleProductClick}
      />

      {totalCartItems > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setShowCheckout(true)}
            className="pointer-events-auto mx-auto flex min-h-14 w-full max-w-3xl items-center justify-between gap-3 rounded-2xl bg-emerald-700 px-4 py-2.5 text-white shadow-lg shadow-emerald-900/25 transition-colors hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2"
            aria-label={`View cart, ${totalCartItems} ${totalCartItems === 1 ? 'item' : 'items'}, total ${formatRiel(totalCartPrice)}`}
          >
            <span className="flex items-center gap-3">
              <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <Icon name="cart" size={20} />
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-emerald-950">
                  {totalCartItems}
                </span>
              </span>
              <span className="text-left leading-tight">
                <span className="block text-xs text-emerald-100">{totalCartItems === 1 ? '1 item' : `${totalCartItems} items`} selected</span>
                <span className="block text-base font-bold">{formatRiel(totalCartPrice)}</span>
              </span>
            </span>
            <span className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-800">
              View cart
            </span>
          </button>
        </div>
      )}

      <CartCheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        cart={cart}
        setCart={setCart}
        session={session}
        requestedSessionId={launch.sessionId}
        orderingOpen={orderingOpen}
        initDataAvailable={initDataAvailable}
        onOrderSuccess={(order, paymentQrImageUrl) => navigate('/my-order', {
          state: { order, payment_qr_image_url: paymentQrImageUrl },
        })}
      />
      <SugarSelectionModal
        key={sugarSelectionKey}
        product={sugarProduct}
        sugarOptions={sugarOptions}
        onClose={() => setSugarProduct(null)}
        onAdd={handleAddToCart}
      />
    </div>
  );
}