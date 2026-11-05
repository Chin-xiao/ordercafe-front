import React, { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import { formatRiel } from '../../utils/currency';
import { getInitData } from '../../utils/telegram';
import { isOrderSessionOpen, unwrapApiData } from '../../utils/orderSession';
import { Icon } from '../../components/ui';

const ALERT_TONES = {
  red: 'border-red-200 bg-red-50 text-red-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
};

function Alert({ tone = 'red', children }) {
  return (
    <p role="alert" className={`rounded-xl border p-3 text-sm ${ALERT_TONES[tone]}`}>
      {children}
    </p>
  );
}

export default function CartCheckoutModal({
  isOpen,
  onClose,
  cart,
  setCart,
  session,
  requestedSessionId,
  orderingOpen,
  initDataAvailable,
  onOrderSuccess,
}) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  // Close with Escape, but never while an order is being submitted
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !loading) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleUpdateQuantity = (cartId, delta) => {
    setCart((previousCart) =>
      previousCart
        .map((item) => {
          if (item.cart_id !== cartId) return item;
          const quantity = item.quantity + delta;
          return quantity > 0 ? { ...item, quantity } : null;
        })
        .filter(Boolean)
    );
  };

  const handleRemoveItem = (cartId) => {
    setCart((previousCart) => previousCart.filter((item) => item.cart_id !== cartId));
  };

  const handleCheckout = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError('');

    try {
      if (!getInitData()) {
        throw new Error('Open this menu from the Telegram group button to submit an order.');
      }
      if (!session?.id || !orderingOpen || !isOrderSessionOpen(session)) {
        throw new Error('Ordering is closed. Refresh the session status before trying again.');
      }
      if (cart.length === 0) {
        throw new Error('Your cart is empty.');
      }
      // Only require sugar percentage if the product has requires_sugar set to true
      if (cart.some((item) => item.requires_sugar && !Number.isInteger(item.sugar_percent))) {
        throw new Error('Choose a sugar percentage for every drink before submitting.');
      }
      if (cart.some((item) => item.quantity > 100)) {
        throw new Error('Each item and option combination is limited to 100 items per order.');
      }

      const sessionResponse = await api.get('/mini-app/order-session/current');
      const currentSession = unwrapApiData(sessionResponse);
      if (
        !currentSession ||
        String(currentSession.id) !== String(session.id) ||
        (requestedSessionId && String(currentSession.id) !== String(requestedSessionId)) ||
        !isOrderSessionOpen(currentSession)
      ) {
        throw new Error('This order session is no longer open. Refresh the menu before submitting.');
      }

      const response = await api.post('/mini-app/orders', {
        order_session_id: session.id,
        note: note.trim(),
        items: cart.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          sugar_percent: item.requires_sugar ? item.sugar_percent : null,
        })),
      });

      const savedOrder = unwrapApiData(response);
      setCart([]);
      onOrderSuccess(savedOrder, response.data?.payment_qr_image_url ?? null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to submit the order. Please try again.'));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const canSubmit = cart.length > 0 && orderingOpen && initDataAvailable && !loading;

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex max-w-3xl flex-col justify-end bg-stone-950/50 sm:justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-dialog-title"
        className="flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:mx-auto sm:w-full sm:max-w-xl sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff1ed] text-[#d4401f]">
              <Icon name="cart" size={20} />
            </span>
            <div className="leading-tight">
              <h2 id="cart-dialog-title" className="text-base font-bold text-stone-900">Your order</h2>
              <p className="text-xs text-stone-500">{totalItems === 1 ? '1 item' : `${totalItems} items`}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close cart"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition-colors hover:bg-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] disabled:opacity-50"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {!orderingOpen && (
            <Alert>Ordering is closed. You can review the cart, but orders cannot be submitted.</Alert>
          )}
          {!initDataAvailable && (
            <Alert tone="amber">Open this page in Telegram to verify your account and submit your order.</Alert>
          )}
          {error && <Alert>{error}</Alert>}

          {cart.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                <Icon name="cart" size={26} />
              </span>
              <p className="mt-3 text-sm font-semibold text-stone-900">Your cart is empty</p>
              <p className="mt-1 text-sm text-stone-500">Add a drink from the menu to get started.</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 min-h-11 rounded-xl border border-stone-300 px-5 text-sm font-semibold text-stone-700 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c]"
              >
                Back to menu
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {cart.map((item) => (
                <li key={item.cart_id} className="flex items-start justify-between gap-3 py-4 first:pt-1">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-stone-900">{item.name}</h3>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
                      {item.requires_sugar && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
                          {item.sugar_percent}% sugar
                        </span>
                      )}
                      <span>{formatRiel(item.price)} each</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.cart_id)}
                      disabled={loading}
                      className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 focus:outline-none focus-visible:underline disabled:opacity-50"
                    >
                      <Icon name="trash" size={14} />
                      Remove
                    </button>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-sm font-bold text-stone-900">{formatRiel(Number(item.price) * item.quantity)}</span>
                    <div className="flex items-center rounded-xl bg-stone-100 p-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.cart_id, -1)}
                        disabled={loading}
                        aria-label={`Remove one ${item.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-stone-700 shadow-sm transition-colors hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] disabled:opacity-50"
                      >
                        <Icon name={item.quantity === 1 ? 'trash' : 'minus'} size={16} />
                      </button>
                      <span aria-live="polite" className="w-9 text-center text-sm font-bold text-stone-900">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.cart_id, 1)}
                        disabled={loading || item.quantity >= 100}
                        aria-label={`Add one ${item.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ef5a3c] text-white shadow-sm transition-colors hover:bg-[#dc4a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] disabled:opacity-50"
                      >
                        <Icon name="plus" size={16} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {cart.length > 0 && (
            <div>
              <label htmlFor="order-note" className="mb-1.5 block text-sm font-semibold text-stone-800">
                Note for the cafe <span className="font-normal text-stone-400">(optional)</span>
              </label>
              <input
                id="order-note"
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. Less sweet, extra ice"
                className="h-12 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-base text-stone-800 outline-none placeholder:text-stone-400 focus:border-[#ef5a3c] focus:bg-white focus:ring-2 focus:ring-[#ef5a3c]/20"
              />
            </div>
          )}
        </div>

        {/* Footer: total + place order */}
        {cart.length > 0 && (
          <div className="space-y-3 border-t border-stone-100 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-stone-700">Subtotal (estimate)</span>
              <span className="text-2xl font-bold text-[#d4401f]">{formatRiel(subtotal)}</span>
            </div>
            <p className="text-xs text-stone-500">The final total is recalculated with current prices when you place the order.</p>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleCheckout}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#ef5a3c] px-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-[#dc4a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {loading ? 'Submitting order…' : `Place order · ${formatRiel(subtotal)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}