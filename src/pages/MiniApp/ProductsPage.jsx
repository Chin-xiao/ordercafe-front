import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { getMenuData } from '../../api/menu';
import { getApiErrorMessage } from '../../api/errors';
import { formatRiel } from '../../utils/currency';
import { getOrderSessionLaunch, getTelegramWebApp } from '../../utils/telegram';
import { isOrderSessionOpen, unwrapApiData } from '../../utils/orderSession';

import SessionBanner from './SessionBanner';
import ProductGrid from './ProductGrid';
import CartCheckoutModal from './CartCheckoutModal';
import SugarSelectionModal from './SugarSelectionModal';

const SESSION_REFRESH_MS = 15000;
const INITIAL_NOW = Date.now();

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
  const [session, setSession] = useState(() => {
    const cached = localStorage.getItem('cached_active_session');
    return cached ? JSON.parse(cached) : null;
  });
  const [sessionVerified, setSessionVerified] = useState(() => {
    return Boolean(localStorage.getItem('cached_active_session'));
  });

  const [showCheckout, setShowCheckout] = useState(false);
  const [sugarProduct, setSugarProduct] = useState(null);
  const [sugarSelectionKey, setSugarSelectionKey] = useState(0);
  const [now, setNow] = useState(INITIAL_NOW);
  
  const menuRequestRef = useRef(null);
  const sessionRequestRef = useRef(null);
  const sessionSignalRef = useRef(null);
  const menuSignalRef = useRef(null);

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
        if (nextSession) {
          localStorage.setItem('cached_active_session', JSON.stringify(nextSession));
        } else {
          localStorage.removeItem('cached_active_session');
        }

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
        setLoading(true);
        setError('');
        const menu = await getMenuData(signal, { force });
        if (signal?.aborted) return;
        setCategories(menu.categories);
        setProducts(menu.products);
        setSugarOptions(menu.sugarOptions);
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

  return (
    <div className="pb-28 bg-gray-50 min-h-screen text-gray-800">
      <SessionBanner
        session={session}
        sessionVerified={sessionVerified}
        sessionError={sessionError}
        onRefresh={refreshSessionStatus}
      />

      {initDataAvailable && (
        <section aria-label="Private Telegram notifications" className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Private notifications: Unable to Check</p>
          <p className="mt-1">
            Your ordering is not affected. If you want private messages from the cafe, open the bot and voluntarily press <strong>Start</strong>.
          </p>
          <a
            className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-emerald-300 bg-white px-4 py-2 font-semibold text-emerald-800 underline"
            href="https://t.me/ahseven_bot?start=order_notifications"
            target="_blank"
            rel="noreferrer"
          >
            Enable Private Notifications
          </a>
        </section>
      )}

      {error && (
        <div role="alert" className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button onClick={() => fetchMenu(menuSignalRef.current, true)} className="mt-2 min-h-11 font-semibold underline">Retry menu</button>
        </div>
      )}

      <nav aria-label="Product categories" className="flex overflow-x-auto px-4 py-3 bg-white shadow-xs gap-2 no-scrollbar sticky top-14 z-10">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
            selectedCategory === 'all' ? 'bg-emerald-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All Items
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              String(selectedCategory) === String(category.id) ? 'bg-emerald-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {category.name}
          </button>
        ))}
      </nav>

      <div className="mx-auto max-w-3xl px-4 pb-2 pt-4">
        <label htmlFor="menu-search" className="sr-only">Search the menu</label>
        <input
          id="menu-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search drinks and treats"
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 shadow-sm outline-none placeholder:text-stone-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
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
        <div className="fixed bottom-0 left-0 right-0 z-30 mx-auto flex max-w-3xl items-center justify-between gap-3 border-t border-stone-200 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur">
          <div>
            <p className="text-xs text-stone-500">{totalCartItems} items selected</p>
            <p className="text-base font-bold text-stone-900">{formatRiel(totalCartPrice)}</p>
          </div>
          <button
            onClick={() => setShowCheckout(true)}
            className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800"
          >
            View Cart & Checkout
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