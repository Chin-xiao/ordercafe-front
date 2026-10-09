import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import { getTelegramWebApp } from '../../utils/telegram';
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

export default function MiniAppProductsPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [session, setSession] = useState(null);
  const [sessionVerified, setSessionVerified] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [now, setNow] = useState(INITIAL_NOW);

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
  const totalCartPrice = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 text-gray-500 text-sm">
        Loading Cafe Menu...
      </div>
    );
  }

  return (
    <div className="pb-28 bg-gray-50 min-h-screen text-gray-800">
      <header className="bg-emerald-600 text-white p-4 shadow-md sticky top-0 z-20 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">☕ {session?.title || 'Cafe Menu'}</h1>
          <p className="text-xs text-emerald-100">
            {session?.expires_at ? `Ordering closes ${formatDateTime(session.expires_at)}` : 'Cafe ordering'}
          </p>
        </div>
        <div className="bg-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
          {orderingOpen
            ? 'Ordering Open'
            : session
              ? status
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
            <p>Ordering closes: {formatDateTime(session.expires_at)}</p>
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

      {!error && (
        <div className="p-4 grid grid-cols-2 gap-3 max-w-lg mx-auto">
          {filteredProducts.map((product) => {
            const cartItem = cart.find((item) => item.id === product.id);
            return (
              <article key={product.id} className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden flex flex-col justify-between">
                <div>
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-28 object-cover" />
                  ) : (
                    <div className="w-full h-28 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">No image</div>
                  )}
                  <div className="p-3">
                    <h2 className="font-bold text-sm text-gray-800">{product.name}</h2>
                    {product.description && <p className="text-xs text-gray-500 mt-1">{product.description}</p>}
                    <p className="text-xs text-emerald-600 font-semibold mt-1">${Number(product.price).toFixed(2)}</p>
                  </div>
                </div>
                <div className="p-3 pt-0">
                  {cartItem ? (
                    <div className="flex items-center justify-between bg-emerald-50 rounded-lg p-1 border border-emerald-200">
                      <button
                        aria-label={`Remove one ${product.name}`}
                        onClick={() => handleUpdateQuantity(product.id, -1)}
                        className="w-7 h-7 bg-white text-emerald-700 font-bold rounded-md shadow-xs"
                      >−</button>
                      <span className="text-xs font-bold text-emerald-800">{cartItem.quantity}</span>
                      <button
                        aria-label={`Add one ${product.name}`}
                        onClick={() => handleUpdateQuantity(product.id, 1)}
                        className="w-7 h-7 bg-emerald-600 text-white font-bold rounded-md shadow-xs"
                      >+</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={!orderingOpen}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 rounded-lg shadow transition disabled:opacity-40"
                    >
                      + Add to Cart
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {filteredProducts.length === 0 && !error && (
            <p className="col-span-2 py-8 text-center text-sm text-gray-500">No products are available in this category.</p>
          )}
        </div>
      )}

      {totalCartItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-30 max-w-lg mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">{totalCartItems} items selected</p>
            <p className="text-base font-bold text-gray-800">${totalCartPrice.toFixed(2)}</p>
          </div>
          <button
            onClick={() => setShowCheckout(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow transition"
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
