// src/pages/CartPage.jsx
import React, { useState } from 'react';
import { useCartStore } from '../store/useCartStore';
import { useNavigate } from 'react-router-dom';

export default function CartPage() {
  const { items, removeItem, addItem, getTotalAmount, submitOrder, activeSession } = useCartStore();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleCheckout = async () => {
    try {
      setSubmitting(true);
      setErrorMsg('');
      await submitOrder();
      navigate('/my-order'); // Redirect to order confirmation/success view
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-gray-700">Your Cart is Empty 🛒</h2>
        <p className="text-gray-500 mt-2">Add some delicious drinks or food from the menu.</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-4">Review Your Cart</h1>
      
      {errorMsg && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          {errorMsg}
        </div>
      )}

      <div className="bg-white rounded-lg shadow divide-y">
        {items.map((item) => (
          <div key={item.product_id} className="p-4 flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{item.name}</h3>
              <p className="text-sm text-gray-500">${item.price.toFixed(2)} each</p>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => removeItem(item.product_id)}
                className="bg-gray-200 px-2.5 py-1 rounded font-bold text-gray-700"
              >
                -
              </button>
              <span className="font-medium">{item.quantity}</span>
              <button 
                onClick={() => addItem(item)}
                className="bg-gray-200 px-2.5 py-1 rounded font-bold text-gray-700"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between text-lg font-bold">
          <span>Total:</span>
          <span>${getTotalAmount().toFixed(2)}</span>
        </div>
      </div>

      <button
        onClick={handleCheckout}
        disabled={submitting || !activeSession}
        className="w-full mt-6 bg-green-600 text-white py-3 rounded-lg font-bold shadow hover:bg-green-700 disabled:opacity-50"
      >
        {submitting ? 'Submitting Order...' : 'Confirm & Submit Order'}
      </button>
    </div>
  );
}