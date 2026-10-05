import React, { useState } from 'react';
import api from '../../api/axios';
import { getTelegramUser } from '../../utils/telegram';

export default function CartCheckoutModal({ isOpen, onClose, cart, setCart, onOrderSuccess }) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const totalCartPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleUpdateQuantity = (productId, delta) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const handleCheckout = async () => {
    try {
      setLoading(true);
      setError('');
      const user = getTelegramUser();

      // Format payload to match your Laravel OrderController expectation
      const payload = {
        initData: user.initData,
        telegram_id: user.id,
        note: note,
        items: cart.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
        })),
      };

      const response = await api.post('/api/mini-app/orders', payload);
      
      // Clear cart and trigger success state
      setCart([]);
      onOrderSuccess(response.data.data || response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end max-w-lg mx-auto">
      <div className="bg-white rounded-t-2xl p-5 max-h-[85vh] flex flex-col shadow-2xl animate-slide-up">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">🛒 Your Order Summary</h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-3 bg-red-50 text-red-600 p-3 rounded-xl text-xs font-medium border border-red-200">
            {error}
          </div>
        )}

        {/* Cart Items List */}
        <div className="overflow-y-auto py-3 space-y-3 flex-1 divide-y divide-gray-50">
          {cart.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">Your cart is empty.</p>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="pt-3 flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-sm text-gray-800">{item.name}</h4>
                  <p className="text-xs text-emerald-600 font-medium">${Number(item.price).toFixed(2)} each</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 p-1">
                    <button 
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="w-6 h-6 bg-white text-gray-700 font-bold rounded shadow-xs flex items-center justify-center text-xs"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-gray-800">{item.quantity}</span>
                    <button 
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="w-6 h-6 bg-emerald-600 text-white font-bold rounded shadow-xs flex items-center justify-center text-xs"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm font-bold text-gray-800 w-16 text-right">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Optional Note Field */}
        {cart.length > 0 && (
          <div className="py-3 border-t border-gray-100">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Special Instructions / Note</label>
            <input 
              type="text" 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Less sweet, extra ice..." 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        )}

        {/* Total and Checkout Button */}
        {cart.length > 0 && (
          <div className="pt-3 border-t border-gray-100 space-y-3">
            <div className="flex justify-between items-center text-base font-bold text-gray-800">
              <span>Total Amount:</span>
              <span className="text-emerald-600 text-lg">${totalCartPrice.toFixed(2)}</span>
            </div>
            <button
              disabled={loading}
              onClick={handleCheckout}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Submitting Order...' : 'Confirm & Place Order 🚀'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}