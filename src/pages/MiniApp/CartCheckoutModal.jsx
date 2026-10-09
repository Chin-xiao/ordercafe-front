import React, { useRef, useState } from 'react';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import { getInitData } from '../../utils/telegram';
import { isOrderSessionOpen, unwrapApiData } from '../../utils/orderSession';

export default function CartCheckoutModal({
  isOpen,
  onClose,
  cart,
  setCart,
  session,
  orderingOpen,
  initDataAvailable,
  onOrderSuccess,
}) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

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

  const handleRemoveItem = (productId) => {
    setCart((previousCart) => previousCart.filter((item) => item.id !== productId));
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

      const sessionResponse = await api.get('/mini-app/order-session/current');
      const currentSession = unwrapApiData(sessionResponse);
      if (
        !currentSession ||
        String(currentSession.id) !== String(session.id) ||
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
        })),
      });

      const savedOrder = unwrapApiData(response);
      setCart([]);
      onOrderSuccess(savedOrder);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to submit the order. Please try again.'));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const canSubmit = cart.length > 0 && orderingOpen && initDataAvailable && !loading;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end max-w-lg mx-auto">
      <div className="bg-white rounded-t-2xl p-5 max-h-[85vh] flex flex-col shadow-2xl animate-slide-up">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">🛒 Your Order Summary</h2>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label="Close cart"
            className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 font-bold disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {!orderingOpen && (
          <p role="alert" className="mt-3 bg-red-50 text-red-700 p-3 rounded-xl text-xs border border-red-200">
            Ordering is closed. You can review the cart, but orders cannot be submitted.
          </p>
        )}
        {!initDataAvailable && (
          <p role="alert" className="mt-3 bg-amber-50 text-amber-800 p-3 rounded-xl text-xs border border-amber-200">
            Open this page in Telegram to verify your account and submit your order.
          </p>
        )}
        {error && (
          <div role="alert" className="mt-3 bg-red-50 text-red-600 p-3 rounded-xl text-xs font-medium border border-red-200">
            {error}
          </div>
        )}

        <div className="overflow-y-auto py-3 space-y-3 flex-1 divide-y divide-gray-50">
          {cart.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">Your cart is empty.</p>
          ) : cart.map((item) => (
            <div key={item.id} className="pt-3 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-gray-800">{item.name}</h3>
                <p className="text-xs text-emerald-600 font-medium">${Number(item.price).toFixed(2)} each</p>
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={loading}
                  className="mt-1 text-xs text-red-600 underline"
                >
                  Remove
                </button>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 p-1">
                  <button
                    onClick={() => handleUpdateQuantity(item.id, -1)}
                    disabled={loading}
                    aria-label={`Remove one ${item.name}`}
                    className="w-7 h-7 bg-white text-gray-700 font-bold rounded shadow-xs text-xs disabled:opacity-50"
                  >−</button>
                  <span className="w-7 text-center text-xs font-bold text-gray-800">{item.quantity}</span>
                  <button
                    onClick={() => handleUpdateQuantity(item.id, 1)}
                    disabled={loading}
                    aria-label={`Add one ${item.name}`}
                    className="w-7 h-7 bg-emerald-600 text-white font-bold rounded shadow-xs text-xs disabled:opacity-50"
                  >+</button>
                </div>
                <span className="text-sm font-bold text-gray-800 w-16 text-right">
                  ${(Number(item.price) * item.quantity).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="py-3 border-t border-gray-100">
            <label htmlFor="order-note" className="block text-xs font-semibold text-gray-500 mb-1">Special Instructions / Note</label>
            <input
              id="order-note"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Less sweet, extra ice..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        )}

        {cart.length > 0 && (
          <div className="pt-3 border-t border-gray-100 space-y-3">
            <div className="flex justify-between items-center text-base font-bold text-gray-800">
              <span>Subtotal (estimate):</span>
              <span className="text-emerald-600 text-lg">${subtotal.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-500">The backend recalculates the final total using current product prices.</p>
            <button
              disabled={!canSubmit}
              onClick={handleCheckout}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Submitting Order...' : 'Confirm & Place Order'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
