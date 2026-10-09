import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import { getTelegramUser, getTelegramWebApp } from '../../utils/telegram';
import {
  formatDateTime,
  formatRemainingTime,
  getSessionStatus,
  isOrderSessionOpen,
  unwrapApiData,
} from '../../utils/orderSession';
import CartCheckoutModal from './CartCheckoutModal';

const SESSION_REFRESH_MS = 15000;
const INITIAL_NOW = Date.now();

function ProductImage({ product }) {
  const [failed, setFailed] = useState(false);
  if (!product.image_url || failed) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-stone-100 text-xs text-stone-400">
        Image unavailable
      </div>
    );
  }

  return (
    <img
      src={product.image_url}
      alt={product.name}
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-[4/3] w-full bg-stone-100 object-cover"
    />
  );
}

export default function MiniAppProductsPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [session, setSession] = useState(null);
  const [sessionVerified, setSessionVerified] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [now, setNow] = useState(INITIAL_NOW);
  const [customerName, setCustomerName] = useState('');

  const fetchSession = useCallback(async () => {
    setSessionVerified(false);
    setSessionError('');
    try {
      const response = await api.get('/mini-app/order-session/current');
      const activeSession = unwrapApiData(response);
      setSession(activeSession && typeof activeSession === 'object' ? activeSession : null);
      setSessionVerified(true);
      return activeSession;
    } catch (err) {
      console.error('Failed to load the current order session', err);
      setSession(null);
      setSessionError(getApiErrorMessage(err, 'Unable to verify the order session.'));
      return null;
    }
  }, []);

  const fetchMenu = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [categoryResponse, productResponse] = await Promise.all([
        api.get('/mini-app/categories'),
        api.get('/mini-app/products'),
      ]);
      const categoryList = unwrapApiData(categoryResponse);
      const productList = unwrapApiData(productResponse);
      if (!Array.isArray(categoryList) || !Array.isArray(productList)) {
        throw new Error('The API returned an invalid menu response.');
      }
      setCategories(categoryList);
      setProducts(productList);
    } catch (err) {
      console.error('Failed to load menu items', err);
      setCategories([]);
      setProducts([]);
      setError(getApiErrorMessage(err, 'Failed to load menu items.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getTelegramWebApp();
    const startup = window.setTimeout(() => {
      const telegramUser = getTelegramUser();
      setCustomerName([telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(' '));
      fetchMenu();
      fetchSession();
    }, 0);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = window.setInterval(fetchSession, SESSION_REFRESH_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') fetchSession();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearTimeout(startup);
      window.clearInterval(clock);
      window.clearInterval(refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [fetchMenu, fetchSession]);

  const status = getSessionStatus(session, now);
  const orderingOpen = sessionVerified && isOrderSessionOpen(session, now);
  const expirationMs = session?.expires_at ? new Date(session.expires_at).getTime() : NaN;
  const secondsRemaining = Number.isFinite(expirationMs)
    ? Math.max(0, Math.floor((expirationMs - now) / 1000))
    : null;
  const nearExpiration = orderingOpen && secondsRemaining !== null && secondsRemaining <= 300;
  const initDataAvailable = Boolean(window.Telegram?.WebApp?.initData);

  const handleAddToCart = (product) => {
    setCart((previousCart) => {
      const existing = previousCart.find((item) => item.id === product.id);
      if (existing) {
        return previousCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...previousCart, { ...product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId, delta) => {
    setCart((previousCart) =>
      previousCart
        .map((item) => {
          if (item.id !== productId) return item;
          const quantity = item.quantity + delta;
          return quantity > 0 ? { ...item, quantity } : null;
        })
        .filter(Boolean)
    );
  };

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter((product) => String(product.category_id) === String(selectedCategory));
  const visibleProducts = filteredProducts.filter((product) => {
    const query = search.trim().toLocaleLowerCase();
    return !query || `${product.name || ''} ${product.description || ''}`.toLocaleLowerCase().includes(query);
  });
  const totalCartPrice = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 text-gray-500 text-sm">
        <div className="w-full max-w-lg px-4" aria-label="Loading cafe menu">
          <div className="mb-4 h-6 w-40 animate-pulse rounded bg-stone-200" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                <div className="aspect-[4/3] animate-pulse bg-stone-200" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-stone-200" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-stone-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28 bg-gray-50 min-h-screen text-gray-800">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-emerald-800/10 bg-emerald-700 px-4 py-3 text-white shadow-sm">
        <div>
          <h1 className="text-base font-bold leading-tight">{session?.title || 'Cafe Menu'}</h1>
          <p className="mt-0.5 text-xs text-emerald-100">
            {customerName ? `Welcome, ${customerName}` : 'Fresh from the cafe'}
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
            <button onClick={fetchSession} className="mt-2 font-semibold underline">
              Refresh session status
            </button>
          </>
        )}
      </section>

      {!initDataAvailable && (
        <p className="mx-4 mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Open this page from the Telegram group button to authenticate and place an order.
        </p>
      )}
      {error && (
        <div role="alert" className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button onClick={fetchMenu} className="mt-2 font-semibold underline">Retry menu</button>
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

      {!error && (
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:gap-4">
          {visibleProducts.map((product) => {
            const cartItem = cart.find((item) => item.id === product.id);
            const unavailable = product.is_available === false;
            return (
              <article key={product.id} className={`flex flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${unavailable ? 'border-stone-200 opacity-75' : 'border-stone-100'}`}>
                <div>
                  <div className="relative">
                    <ProductImage product={product} />
                    {unavailable && (
                      <span className="absolute left-2 top-2 rounded-full bg-stone-900/80 px-2.5 py-1 text-[10px] font-semibold text-white">
                        Unavailable
                      </span>
                    )}
                  </div>
                  <div className="p-3 sm:p-4">
                    <h2 className="line-clamp-2 min-h-10 text-sm font-bold text-stone-900">{product.name}</h2>
                    {product.description && <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed text-stone-500">{product.description}</p>}
                    <p className="mt-2 text-sm font-bold text-emerald-700">${Number(product.price).toFixed(2)}</p>
                    <p className={`mt-1 text-[11px] font-medium ${unavailable ? 'text-red-700' : 'text-stone-500'}`}>
                      {unavailable ? 'Currently unavailable' : product.is_available === true ? 'Available' : 'Availability not provided'}
                    </p>
                  </div>
                </div>
                <div className="p-3 pt-0">
                  {cartItem ? (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-1">
                      <button
                        aria-label={`Remove one ${product.name}`}
                        onClick={() => handleUpdateQuantity(product.id, -1)}
                        className="h-9 w-9 rounded-lg bg-white font-bold text-emerald-700 shadow-sm"
                      >−</button>
                      <span className="text-sm font-bold text-emerald-800" aria-live="polite">{cartItem.quantity}</span>
                      <button
                        aria-label={`Add one ${product.name}`}
                        onClick={() => handleUpdateQuantity(product.id, 1)}
                        disabled={unavailable}
                        className="h-9 w-9 rounded-lg bg-emerald-700 font-bold text-white shadow-sm disabled:opacity-50"
                      >+</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={!orderingOpen || unavailable}
                      className="w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                    >
                      {unavailable ? 'Unavailable' : '+ Add to Cart'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {visibleProducts.length === 0 && !error && (
            <p className="col-span-full py-8 text-center text-sm text-stone-500">
              {search ? 'No menu items match your search.' : 'No products are available in this category.'}
            </p>
          )}
        </div>
      )}

      {totalCartItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 mx-auto flex max-w-3xl items-center justify-between gap-3 border-t border-stone-200 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur">
          <div>
            <p className="text-xs text-stone-500">{totalCartItems} items selected</p>
            <p className="text-base font-bold text-stone-900">${totalCartPrice.toFixed(2)}</p>
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
        orderingOpen={orderingOpen}
        initDataAvailable={initDataAvailable}
        onOrderSuccess={(order) => navigate('/my-order', { state: { order } })}
      />
    </div>
  );
}
