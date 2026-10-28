import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { getMenuData } from '../../api/menu';
import { getApiErrorMessage } from '../../api/errors';
import { formatRiel } from '../../utils/currency';
import { getOrderSessionLaunch, getTelegramWebApp } from '../../utils/telegram';
import {
  formatDateTime,
  formatRemainingTime,
  getSessionStatus,
  isOrderSessionOpen,
  unwrapApiData,
} from '../../utils/orderSession';
import CartCheckoutModal from './CartCheckoutModal';
import SugarSelectionModal from './SugarSelectionModal';

const SESSION_REFRESH_MS = 15000;
const INITIAL_NOW = Date.now();

const ProductImage = React.memo(function ProductImage({ product, eager = false }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!product.image_url || failed) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-stone-100 text-xs text-stone-400" aria-label={`Image unavailable for ${product.name}`}>
        Image unavailable
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
      {!loaded && <div aria-hidden="true" className="absolute inset-0 bg-stone-100" />}
      <img
        src={product.image_url}
        alt={product.name}
        width="480"
        height="360"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : 'auto'}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
});

const SessionHeader = React.memo(function SessionHeader({ session, sessionVerified, sessionError, onRefresh }) {
  const [now, setNow] = useState(INITIAL_NOW);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const status = getSessionStatus(session, now);
  const orderingOpen = sessionVerified && isOrderSessionOpen(session, now);
  const expirationMs = session?.expires_at ? new Date(session.expires_at).getTime() : NaN;
  const secondsRemaining = Number.isFinite(expirationMs)
    ? Math.max(0, Math.floor((expirationMs - now) / 1000))
    : null;
  const nearExpiration = orderingOpen && secondsRemaining !== null && secondsRemaining <= 300;

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-emerald-800/10 bg-emerald-700 px-4 py-3 text-white shadow-sm">
        <div>
          <h1 className="text-base font-bold leading-tight">{session?.title || 'Cafe Menu'}</h1>
          <p className="mt-0.5 text-xs text-emerald-100">
            Fresh from the cafe
          </p>
        </div>
        <div className="max-w-[45%] rounded-full bg-emerald-800 px-3 py-1.5 text-right text-[11px] font-semibold leading-tight">
          {orderingOpen
            ? `Open · Closes ${new Date(session.expires_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
            : session
              ? status.toLowerCase() === 'expired' ? 'Expired' : 'Ordering closed'
              : sessionVerified
                ? 'No Session'
                : 'Checking...'}
        </div>
      </header>
      <section
        role={nearExpiration ? 'alert' : undefined}
        className={`mx-4 mt-4 rounded-xl border p-3 text-sm ${
          orderingOpen
            ? nearExpiration
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}
      >
        {orderingOpen ? (
          <>
            <p className="font-bold">{session.title}</p>
            <p>Ordering closes at {new Date(session.expires_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {formatDateTime(session.expires_at)}</p>
            <p className="font-semibold">
              {nearExpiration ? 'Hurry, ordering closes soon: ' : 'Time remaining: '}
              {formatRemainingTime(session.expires_at, now)}
            </p>
          </>
        ) : (
          <>
            <p className="font-bold">Ordering is closed</p>
            <p>
              {session?.expires_at
                ? `This ordering session is ${status.toLowerCase()}. It closed at ${formatDateTime(session.expires_at)}.`
                : 'There is no currently open order session.'}
            </p>
            {(sessionError || !sessionVerified) && (
              <p className="mt-1">{sessionError || 'Verifying session status with the server...'}</p>
            )}
            <button type="button" onClick={onRefresh} className="mt-2 min-h-11 font-semibold underline">
              Refresh session status
            </button>
          </>
        )}
      </section>
    </>
  );
});

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
  const [session, setSession] = useState(null);
  const [sessionVerified, setSessionVerified] = useState(false);
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
        setSession((previous) => {
          if (
            previous?.id === nextSession?.id &&
            previous?.title === nextSession?.title &&
            previous?.status === nextSession?.status &&
            previous?.expires_at === nextSession?.expires_at &&
            previous?.ordering_allowed === nextSession?.ordering_allowed
          ) return previous;
          return nextSession;
        });
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
    const startup = window.setTimeout(() => {
      fetchMenu(controller.signal);
      fetchSession(controller.signal);
    }, 0);
    const refresh = window.setInterval(() => fetchSession(controller.signal), SESSION_REFRESH_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchMenu(controller.signal);
        fetchSession(controller.signal);
      }
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearTimeout(startup);
      window.clearInterval(refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      sessionSignalRef.current = null;
      menuSignalRef.current = null;
      sessionRequestRef.current = null;
      menuRequestRef.current = null;
      controller.abort();
    };
  }, [fetchMenu, fetchSession]);

  const orderingOpen = sessionVerified && isOrderSessionOpen(session, now);
  const initDataAvailable = Boolean(window.Telegram?.WebApp?.initData);

  useEffect(() => {
    const expiration = session?.expires_at ? new Date(session.expires_at).getTime() : NaN;
    if (!sessionVerified || !Number.isFinite(expiration) || expiration <= Date.now()) return undefined;
    const timeout = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(expiration - Date.now() + 10, 2147483647)
    );
    return () => window.clearTimeout(timeout);
  }, [session?.expires_at, sessionVerified]);

  const handleProductClick = (product) => {
    if (product.requires_sugar) {
      setSugarSelectionKey((value) => value + 1);
      setSugarProduct(product);
    } else {
      // Directly add to cart with null/no sugar and quantity 1
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
      <SessionHeader
        session={session}
        sessionVerified={sessionVerified}
        sessionError={sessionError}
        onRefresh={refreshSessionStatus}
      />

      {initDataAvailable && (
        <section aria-label="Private Telegram notifications" className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Private notifications: Unable to Check</p>
          <p className="mt-1">
            Your ordering is not affected. If you want private messages from the cafe, open the bot and voluntarily press <strong>Start</strong>. The Mini App cannot confirm whether this is already enabled.
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

      {!initDataAvailable && (
        <p className="mx-4 mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Open this page from the Telegram group button to authenticate and place an order.
        </p>
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

      {(!error || products.length > 0) && (
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:gap-4">
          {loading && products.length === 0 ? (
            [0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="overflow-hidden rounded-2xl border border-stone-200 bg-white" aria-hidden="true">
                <div className="aspect-[4/3] bg-stone-100" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-3/4 rounded bg-stone-100" />
                  <div className="h-3 w-1/3 rounded bg-stone-100" />
                </div>
              </div>
            ))
          ) : visibleProducts.map((product, index) => {
            const unavailable = product.is_available === false;
            return (
              <article key={product.id} className={`flex flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${unavailable ? 'border-stone-200 opacity-75' : 'border-stone-100'}`}>
                <div>
                  <div className="relative">
                    <ProductImage key={product.image_url} product={product} eager={index < 2} />
                    {unavailable && (
                      <span className="absolute left-2 top-2 rounded-full bg-stone-900/80 px-2.5 py-1 text-[10px] font-semibold text-white">
                        Unavailable
                      </span>
                    )}
                  </div>
                  <div className="p-3 sm:p-4">
                    <h2 className="line-clamp-2 min-h-10 text-sm font-bold text-stone-900">{product.name}</h2>
                    {product.description && <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed text-stone-500">{product.description}</p>}
                    <p className="mt-2 text-sm font-bold text-emerald-700">{formatRiel(product.price)}</p>
                    <p className={`mt-1 text-[11px] font-medium ${unavailable ? 'text-red-700' : 'text-stone-500'}`}>
                      {unavailable ? 'Currently unavailable' : product.is_available === true ? 'Available' : 'Availability not provided'}
                    </p>
                  </div>
                </div>
                <div className="p-3 pt-0">
                  {cartByProduct.has(String(product.id)) && (
                    <p className="mb-2 text-[11px] text-stone-500">
                      In cart: {cartByProduct.get(String(product.id))
                        .map((item) => item.sugar_percent !== null ? `${item.sugar_percent}% × ${item.quantity}` : `${item.quantity}`)
                        .join(' · ')}
                    </p>
                  )}
                  <button
                    onClick={() => handleProductClick(product)}
                    disabled={!orderingOpen || unavailable}
                    className="w-full min-h-11 rounded-xl bg-emerald-700 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                  >
                    {unavailable ? 'Unavailable' : product.requires_sugar ? '+ Choose Sugar & Add' : '+ Add to Order'}
                  </button>
                </div>
              </article>
            );
          })}
          {visibleProducts.length === 0 && !error && (
            <p className="col-span-full py-8 text-center text-sm text-stone-500">
              {loading
                ? 'Loading drinks…'
                : search
                  ? 'No menu items match your search.'
                  : 'No products are available in this category.'}
            </p>
          )}
        </div>
      )}

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