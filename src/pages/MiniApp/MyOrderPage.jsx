import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import { formatRiel } from '../../utils/currency';
import { closeTelegramApp } from '../../utils/telegram';
import { Icon } from '../../components/ui';
import CoffeeLoader from '../../components/CoffeeLoader';

const STEPS = ['Received', 'Preparing', 'Confirmed'];

const STATUS = {
  pending: {
    label: 'Pending review', hint: 'The cafe team will check your order shortly.', step: 0, icon: 'clock',
    box: 'border-sky-200 bg-sky-50', wrap: 'bg-sky-100 text-sky-700', text: 'text-sky-900',
  },
  preparing: {
    label: 'Preparing your drink', hint: 'Your order is being made right now.', step: 1, icon: 'cup',
    box: 'border-amber-200 bg-amber-50', wrap: 'bg-amber-100 text-amber-700', text: 'text-amber-900',
  },
  completed: {
    label: 'Order confirmed', hint: 'Thank you. Your order is confirmed.', step: 2, icon: 'check',
    box: 'border-emerald-200 bg-emerald-50', wrap: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-900',
  },
  cancelled: {
    label: 'Order cancelled', hint: 'This order was cancelled. Contact the cafe if this is a mistake.', step: -1, icon: 'close',
    box: 'border-rose-200 bg-rose-50', wrap: 'bg-rose-100 text-rose-700', text: 'text-rose-900',
  },
};

function statusKey(status) {
  const value = status?.toLowerCase();
  if (value === 'completed' || value === 'success') return 'completed';
  if (value === 'preparing') return 'preparing';
  if (value === 'cancelled') return 'cancelled';
  return 'pending';
}

export default function MyOrderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialOrder = location.state?.order;
  const [order, setOrder] = useState(initialOrder || null);
  const [paymentQrImageUrl, setPaymentQrImageUrl] = useState(
    location.state?.payment_qr_image_url ?? null
  );
  const [paymentLink, setPaymentLink] = useState(
    location.state?.payment_link ?? null
  );
  const [failedQrImageUrl, setFailedQrImageUrl] = useState('');
  const [thankYouMessage, setThankYouMessage] = useState('');
  const [loading, setLoading] = useState(!initialOrder);
  const [error, setError] = useState('');
  const closeTimer = useRef(null);

  const fetchMyOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/mini-app/my-order');
      const refreshedOrder = response.data?.data
        || (response.data?.id ? response.data : null);
      if (refreshedOrder) setOrder(refreshedOrder);

      // Update both payment QR image and payment link
      setPaymentQrImageUrl(response.data?.payment_qr_image_url ?? null);
      setPaymentLink(response.data?.payment_link ?? null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No active order found for this session.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(fetchMyOrder, 0);
    // Poll only while the app is visible, and refresh as soon as the customer returns
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchMyOrder();
    }, 10000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchMyOrder();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(initialFetch);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchMyOrder, initialOrder]);

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  const handleDonePaid = () => {
    setThankYouMessage('Thanks for letting us know. Payment has not been verified by the app.');
    closeTimer.current = window.setTimeout(closeTelegramApp, 1500);
  };

  const handlePayNow = () => {
    if (!paymentLink) return;

    // Use native Telegram link opener if in Telegram WebApp
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(paymentLink);
    } else {
      window.open(paymentLink, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading && !order) {
    return (
      <CoffeeLoader
        title="Checking your order"
        message="Fetching the latest status from the cafe."
      />
    );
  }

  const status = STATUS[statusKey(order?.status)];

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-stone-50 p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] text-stone-800">
      <header className="mb-4 flex items-center gap-3 rounded-2xl bg-[#1f1a17] p-4 text-white shadow-sm">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <Icon name="receipt" size={22} />
        </span>
        <div className="leading-tight">
          <h1 className="text-lg font-bold">Order tracking</h1>
          <p className="mt-0.5 text-xs text-stone-400">Live updates from the cafe team</p>
        </div>
      </header>

      {error && !order ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-400">
            <Icon name="cup" size={28} />
          </span>
          <h2 className="mt-4 text-base font-bold text-stone-900">No active order</h2>
          <p className="mt-1 text-sm text-stone-500">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="mt-5 min-h-12 rounded-xl bg-[#ef5a3c] px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#dc4a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] focus-visible:ring-offset-2"
          >
            Browse menu and order
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Showing the order returned at checkout. Latest status could not be refreshed: {error}
              <button type="button" onClick={fetchMyOrder} className="ml-1 font-semibold underline">Retry</button>
            </div>
          )}

          {/* Status */}
          <section role="status" aria-live="polite" className={`rounded-2xl border p-4 ${status.box}`}>
            <div className="flex items-center gap-3">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${status.wrap}`}>
                <Icon name={status.icon} size={24} />
              </span>
              <div className="min-w-0">
                <p className={`text-base font-bold ${status.text}`}>{status.label}</p>
                <p className="text-sm text-stone-600">{status.hint}</p>
              </div>
            </div>

            {status.step >= 0 && (
              <ol className="mt-4 flex items-center" aria-label="Order progress">
                {STEPS.map((label, index) => {
                  const done = index <= status.step;
                  return (
                    <li key={label} className="flex flex-1 items-center last:flex-none">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-[#ef5a3c] text-white' : 'bg-white text-stone-400 ring-1 ring-stone-200'}`}>
                          {done ? <Icon name="check" size={14} /> : index + 1}
                        </span>
                        <span className={`text-[11px] font-medium ${done ? 'text-stone-800' : 'text-stone-400'}`}>{label}</span>
                      </div>
                      {index < STEPS.length - 1 && (
                        <span className={`mx-2 mb-4 h-0.5 flex-1 rounded-full ${index < status.step ? 'bg-[#ef5a3c]' : 'bg-stone-200'}`} />
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Order details */}
          <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <p className="text-xs font-medium text-stone-500">Order number</p>
                <h2 className="font-mono text-lg font-bold text-stone-900">
                  {order?.order_number || (order?.id ? `#${order.id}` : 'Submitted')}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-stone-500">Session</p>
                <p className="text-sm font-semibold text-stone-900">
                  {order?.session?.title || order?.order_session?.title || 'Cafe run'}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-stone-900">Ordered items</h3>
              <ul className="mt-2 divide-y divide-stone-100">
                {order?.items?.map((item, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-900">
                        {item.product_name || item.product?.name || item.name}
                      </p>
                      <p className="text-xs text-stone-500">
                        {item.sugar_percent !== null && item.sugar_percent !== undefined
                          ? `${item.sugar_percent}% sugar · `
                          : ''}
                        Qty: {item.quantity} · {formatRiel(item.unit_price ?? item.price)} each
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-stone-900">
                      {formatRiel(item.subtotal ?? Number(item.unit_price ?? item.price) * Number(item.quantity))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {order?.note && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <span className="font-semibold">Note:</span> {order.note}
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3">
              <span className="text-sm font-semibold text-stone-700">Total</span>
              <span className="text-xl font-bold text-[#d4401f]">{formatRiel(order?.total_amount ?? order?.total_price)}</span>
            </div>
          </section>

          {/* Payment */}
          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 text-center shadow-sm">
            <h3 className="text-base font-bold text-stone-900">Payment</h3>

            {paymentLink && (
              <button
                type="button"
                onClick={handlePayNow}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ef5a3c] px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#dc4a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] focus-visible:ring-offset-2 active:scale-[0.99]"
              >
                <Icon name="card" size={18} />
                Pay now
              </button>
            )}

            {paymentQrImageUrl && failedQrImageUrl !== paymentQrImageUrl ? (
              <div className="space-y-2">
                <div className="mx-auto w-full max-w-72 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
                  <img
                    src={paymentQrImageUrl}
                    alt="Cafe payment QR code"
                    onError={() => setFailedQrImageUrl(paymentQrImageUrl)}
                    className="mx-auto max-h-72 w-full rounded-lg object-contain"
                  />
                </div>
                <p className="text-xs text-stone-500">Scan the QR code with your mobile banking app</p>
              </div>
            ) : (
              !paymentLink && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {paymentQrImageUrl
                    ? 'The payment QR image could not be loaded. Please contact cafe staff for payment instructions.'
                    : 'No payment QR is configured for this order. Please contact cafe staff for payment instructions.'}
                </p>
              )
            )}

            {thankYouMessage && (
              <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{thankYouMessage}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={closeTelegramApp}
                className="min-h-12 flex-1 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
              >
                Pay later
              </button>
              <button
                type="button"
                onClick={handleDonePaid}
                disabled={Boolean(thankYouMessage)}
                className="min-h-12 flex-1 rounded-xl bg-[#ef5a3c] px-4 text-sm font-bold text-white transition-colors hover:bg-[#dc4a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] focus-visible:ring-offset-2 disabled:opacity-50"
              >
                I have paid
              </button>
            </div>
          </section>

          <button
            type="button"
            onClick={fetchMyOrder}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-100 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            <Icon name="refresh" size={16} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} />
            Refresh status
          </button>
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="flex min-h-12 w-full items-center justify-center rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c]"
          >
            Back to menu
          </button>
        </div>
      )}
    </div>
  );
}