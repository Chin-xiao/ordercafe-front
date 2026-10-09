import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';

export default function MyOrderPage() {
  const location = useLocation();
  const initialOrder = location.state?.order;
  const [order, setOrder] = useState(initialOrder || null);
  const [loading, setLoading] = useState(!initialOrder);
  const [error, setError] = useState('');

  const fetchMyOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/mini-app/my-order');
      setOrder(response.data.data || response.data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No active order found for this session.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialFetch = initialOrder
      ? null
      : window.setTimeout(() => { fetchMyOrder(); }, 0);
    const interval = setInterval(fetchMyOrder, 10000);
    return () => {
      if (initialFetch !== null) window.clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, [fetchMyOrder, initialOrder]);

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">✅ Order Confirmed</span>;
      case 'preparing':
        return <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full animate-pulse">☕ Preparing Your Drink</span>;
      case 'cancelled':
        return <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">❌ Order Cancelled</span>;
      default:
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">⏳ Pending Review</span>;
    }
  };

  if (loading && !order) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 text-gray-500 text-sm">
        Checking your order status...
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto bg-gray-50 min-h-screen text-gray-800 pb-12">
      <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-md mb-4 text-center">
        <h1 className="text-lg font-bold">📋 Order Tracking</h1>
        <p className="text-xs text-emerald-100 mt-1">Live updates from the cafe team</p>
      </div>

      {error && !order ? (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center space-y-3">
          <div className="text-3xl">☕</div>
          <h3 className="font-bold text-gray-800 text-base">No Active Order</h3>
          <p className="text-xs text-gray-500">{error}</p>
          <button
            onClick={() => window.location.href = '/menu'}
            className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow transition"
          >
            Browse Menu & Order
          </button>
        </div>
      ) : (
        <>
        {error && (
          <div role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Showing the order returned at checkout. Latest status could not be refreshed: {error}
            <button onClick={fetchMyOrder} className="ml-1 font-semibold underline">Retry</button>
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          
          {/* Order Meta Header */}
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <span className="text-xs text-gray-400 font-semibold uppercase">Order number</span>
              <h2 className="font-mono font-bold text-gray-800 text-base">
                {order?.order_number || (order?.id ? `#${order.id}` : 'Submitted')}
              </h2>
            </div>
            <div>{getStatusBadge(order?.status)}</div>
          </div>

          {/* Session Title */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex justify-between items-center text-xs">
            <span className="text-gray-500 font-semibold">Session:</span>
            <span className="font-bold text-gray-800">{order?.order_session?.title || 'Cafe Run'}</span>
          </div>

          {/* Items List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase">Ordered Items</h3>
            <div className="divide-y divide-gray-50">
              {order?.items?.map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between items-center text-sm">
                  <div>
                    <h4 className="font-semibold text-gray-800">{item.product?.name || item.name}</h4>
                    <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                  </div>
                  <span className="font-bold text-emerald-600">
                    ${(Number(item.price) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Note */}
          {order?.note && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800">
              <span className="font-bold">Note:</span> {order.note}
            </div>
          )}

          {/* Total Price Bar */}
          <div className="border-t border-gray-100 pt-3 flex justify-between items-center text-base font-bold text-gray-800">
            <span>Total Paid:</span>
            <span className="text-emerald-600 text-lg">${Number(order?.total_price || 0).toFixed(2)}</span>
          </div>

          <button
            onClick={fetchMyOrder}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2.5 rounded-xl transition"
          >
            Refresh Status 🔄
          </button>
        </div>
        </>
      )}
    </div>
  );
}