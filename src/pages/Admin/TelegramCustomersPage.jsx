import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';

const PAGE_SIZE = 15;
const MESSAGE_LIMIT = 4096;

const formatMoney = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(Number(value) || 0);

const formatDateTime = (value, timeZone) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(date);
  }
};

const getDisplayName = (customer) => {
  const name = [customer.first_name, customer.last_name]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .trim();
  if (name) return name;

  const displayName = customer.display_name?.trim();
  if (displayName) return displayName;

  return customer.telegram_user_id
    ? `Telegram customer ${customer.telegram_user_id}`
    : 'Telegram customer';
};

const getPrivateChatStatus = (customer) => {
  const status = String(customer?.private_chat_status || '').toLowerCase();
  if (['blocked', 'bot_blocked', 'unavailable'].includes(status)) return 'unavailable';
  if (customer?.private_chat_activated === true) return 'enabled';
  if (customer?.private_chat_activated === false) return 'not-started';
  if (['enabled', 'active', 'started'].includes(status)) return 'enabled';
  if (['not_started', 'not-started'].includes(status)) return 'not-started';
  return 'unknown';
};

const getMessageFailure = (requestError) => {
  const response = requestError.response;
  const body = response?.data || {};
  const data = body.data && typeof body.data === 'object' ? body.data : {};
  const code = [
    body.error_code,
    body.code,
    body.error,
    data.error_code,
    data.code,
    data.error,
  ].find((value) => typeof value === 'string' && value.trim())?.toUpperCase() || '';
  const details = [body.error, data.error, body.message, data.message]
    .filter((value) => typeof value === 'string' && value.trim());
  const detail = details[0] || '';
  const detailLower = details.join(' ').toLowerCase();

  if (
    [
      'BOT_BLOCKED',
      'BOT_BLOCKED_BY_CUSTOMER',
      'TELEGRAM_BOT_BLOCKED',
      'PRIVATE_CHAT_BLOCKED',
    ].includes(code) ||
    /bot was blocked by the user|user blocked the bot/i.test(detailLower)
  ) {
    return {
      kind: 'blocked',
      message: 'Telegram confirmed that this customer blocked the bot. Ask them to unblock the bot and press Start again before sending another message.',
    };
  }

  if (
    code === 'PRIVATE_CHAT_NOT_STARTED' ||
    /customer must open .*private chat and press start|private chat (?:has )?not started|can.t initiate conversation/i.test(detailLower)
  ) {
    return {
      kind: 'not-started',
      message: 'This customer has not started a private chat with the bot yet. They can continue ordering in the Mini App, but must open the bot privately and press Start before receiving direct messages.',
    };
  }

  if (
    ['PRIVATE_CHAT_UNAVAILABLE', 'TELEGRAM_FORBIDDEN'].includes(code) ||
    /chat not found/i.test(detailLower)
  ) {
    return {
      kind: 'unavailable',
      message: detail || 'Telegram could not use this private chat. Ask the customer to open the bot privately and press Start again.',
    };
  }

  if (response?.status === 429) {
    const retryAfter = response.headers?.['retry-after'];
    const retryText = retryAfter && !/retry in \d+ seconds/i.test(detail)
      ? ` Please retry in ${retryAfter} seconds.`
      : detail
        ? ''
        : ' Please wait before retrying.';
    return {
      kind: 'rate-limit',
      message: `${detail || 'Telegram is rate limiting messages.'}${retryText}`,
    };
  }

  if (response?.status === 401) {
    return {
      kind: 'auth',
      message: 'Your Admin session has expired. Sign in again before sending this message.',
    };
  }

  if (['TELEGRAM_NETWORK_ERROR'].includes(code)) {
    return {
      kind: 'network',
      message: detail || 'Telegram could not be reached. The message was not confirmed as delivered; please retry later.',
    };
  }

  if (code === 'TELEGRAM_NOT_CONFIGURED') {
    return {
      kind: 'api',
      message: detail || 'Private Telegram messaging is temporarily unavailable because the bot is not configured.',
    };
  }

  if (requestError.request || requestError.code === 'ERR_NETWORK') {
    return {
      kind: 'network',
      message: getApiErrorMessage(requestError, 'Could not reach the messaging service. Check your connection and try again.'),
    };
  }

  if (detail) return { kind: 'api', message: detail };
  if (response?.status >= 500) {
    return {
      kind: 'api',
      message: `The messaging service failed (HTTP ${response.status}). The message was not confirmed as delivered.`,
    };
  }

  return {
    kind: 'api',
    message: getApiErrorMessage(requestError, 'The message was not confirmed as delivered. Please try again.'),
  };
};

function PrivateChatStatus({ status }) {
  const statusText = {
    enabled: 'Private messaging enabled',
    'not-started': 'Private chat not started',
    unavailable: 'Bot blocked or unavailable',
    unknown: 'Activation status not provided by the backend',
  }[status];
  const statusClass = status === 'enabled'
    ? 'text-emerald-700'
    : status === 'unknown'
      ? 'text-gray-500'
      : 'text-amber-800';

  return (
    <p className={`mt-2 text-xs font-semibold ${statusClass}`} role="status">
      {statusText}
    </p>
  );
}

const normalizePage = (page) => ({
  currentPage: Number(page?.current_page) || 1,
  lastPage: Math.max(1, Number(page?.last_page) || 1),
  total: Number(page?.total) || 0,
  perPage: Number(page?.per_page) || PAGE_SIZE,
});

const makeParams = ({ dates, page, search, status, sessionId }) => {
  const params = { page, per_page: PAGE_SIZE };
  if (dates?.from) params.date_from = dates.from;
  if (dates?.to) params.date_to = dates.to;
  if (search?.trim()) params.search = search.trim();
  if (status) params.status = status;
  if (sessionId) params.order_session_id = sessionId;
  return params;
};

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100';
const primaryButtonClass = 'rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButtonClass = 'rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60';

function Pagination({ currentPage, lastPage, total, onChange }) {
  if (total === 0) return null;

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm">
      <p className="text-gray-500">
        Page {currentPage} of {lastPage} <span className="px-1">·</span> {total} total
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={secondaryButtonClass}
          aria-label="Previous page"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onChange(currentPage + 1)}
          disabled={currentPage >= lastPage}
          className={secondaryButtonClass}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </nav>
  );
}

function CustomerModal({ customer, onClose, timeZone, onMessageSent }) {
  const [profile, setProfile] = useState(customer);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(normalizePage());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedOrders, setExpandedOrders] = useState({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState('');
  const [dateError, setDateError] = useState('');
  const [query, setQuery] = useState({ dates: null, sessionId: '', status: '', page: 1 });
  const dateDraftDirty = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const loadOrders = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get(`/admin/customers/${customer.id}/orders`, {
          params: makeParams(query),
          signal: controller.signal,
        });
        const result = response.data;
        if (!result?.customer || !Array.isArray(result?.orders?.data)) {
          throw new Error('The API returned an invalid customer order history response.');
        }

        setProfile((current) => ({ ...current, ...result.customer }));
        setOrders(result.orders.data);
        const nextPagination = normalizePage(result.orders);
        setPagination(nextPagination);
        if (query.page > nextPagination.lastPage) {
          setQuery((current) => ({ ...current, page: nextPagination.lastPage }));
          return;
        }
        if (result.filters?.timezone) onMessageSent({ type: 'timezone', value: result.filters.timezone });
        if (!dateDraftDirty.current) {
          setDateFrom(result.filters?.date_from || '');
          setDateTo(result.filters?.date_to || '');
        }
      } catch (requestError) {
        if (requestError.code === 'ERR_CANCELED') return;
        console.error('Failed to load customer order history', requestError);
        setError(getApiErrorMessage(requestError, 'Failed to load this customer’s order history.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadOrders();
    return () => controller.abort();
  }, [customer.id, onMessageSent, query]);

  const applyFilters = (event) => {
    event.preventDefault();
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setDateError('From date must be on or before the to date.');
      return;
    }

    setDateError('');
    dateDraftDirty.current = false;
    setQuery({
      dates: dateFrom || dateTo ? { from: dateFrom, to: dateTo } : null,
      sessionId,
      status,
      page: 1,
    });
  };

  const toggleOrder = (orderId) => {
    setExpandedOrders((current) => ({ ...current, [orderId]: !current[orderId] }));
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/50 p-3 sm:p-6" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-details-title"
        className="mx-auto my-4 max-w-5xl overflow-hidden rounded-2xl bg-stone-50 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Telegram customer</p>
            <h2 id="customer-details-title" className="mt-1 text-xl font-bold text-gray-900">
              Order history
            </h2>
          </div>
          <button type="button" onClick={onClose} className={secondaryButtonClass} aria-label="Close customer details">
            Close
          </button>
        </header>

        <div className="space-y-5 p-4 sm:p-7">
          <section aria-label="Customer profile" className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{getDisplayName(profile)}</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {profile.telegram_username ? `@${String(profile.telegram_username).replace(/^@/, '')}` : 'No username'}
                </p>
                <p className="mt-1 text-xs text-gray-500">Telegram ID: {profile.telegram_user_id ?? '—'}</p>
                <PrivateChatStatus status={getPrivateChatStatus(profile)} />
              </div>
              <button type="button" onClick={() => onMessageSent({ type: 'open-message', customer: profile })} className={primaryButtonClass}>
                Send Message
              </button>
            </div>
            <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-gray-500">Orders in selected list range</dt>
                <dd className="mt-1 text-lg font-bold text-gray-900">{customer.order_count ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Spending in selected list range</dt>
                <dd className="mt-1 text-lg font-bold text-emerald-700">{formatMoney(customer.total_spending)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Latest order in selected list range</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  {formatDateTime(customer.latest_order_at, timeZone)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Detailed order history</h3>
              <p className="mt-1 text-sm text-gray-500">Prices and subtotals are the saved values from each order.</p>
            </div>

            <form onSubmit={applyFilters} className="grid grid-cols-1 items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor="customer-order-date-from" className="mb-1 block text-xs font-semibold text-gray-600">From date</label>
                <input id="customer-order-date-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => { dateDraftDirty.current = true; setDateFrom(event.target.value); }} className={inputClass} />
              </div>
              <div>
                <label htmlFor="customer-order-date-to" className="mb-1 block text-xs font-semibold text-gray-600">To date</label>
                <input id="customer-order-date-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { dateDraftDirty.current = true; setDateTo(event.target.value); }} className={inputClass} />
              </div>
              <div>
                <label htmlFor="customer-order-session" className="mb-1 block text-xs font-semibold text-gray-600">Session ID</label>
                <input id="customer-order-session" type="number" min="1" value={sessionId} onChange={(event) => setSessionId(event.target.value)} placeholder="Any session" className={inputClass} />
              </div>
              <div>
                <label htmlFor="customer-order-status" className="mb-1 block text-xs font-semibold text-gray-600">Order status</label>
                <select id="customer-order-status" value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
                  <option value="">All statuses</option>
                  <option value="submitted">Submitted</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <button type="submit" disabled={loading} className={primaryButtonClass}>Apply filters</button>
              {dateError && <p role="alert" className="text-sm text-red-700 sm:col-span-2 lg:col-span-5">{dateError}</p>}
            </form>

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <p>{error}</p>
                <button type="button" onClick={() => setQuery((current) => ({ ...current }))} className="mt-2 font-semibold underline">
                  Retry
                </button>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              {loading ? (
                <div aria-label="Loading order history" className="space-y-3 p-5">
                  {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-gray-100" />)}
                </div>
              ) : error ? null : orders.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="font-semibold text-gray-800">No orders match these filters</p>
                  <p className="mt-1 text-sm text-gray-500">Try a different date range, session ID, or status.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {orders.map((order) => {
                    const expanded = Boolean(expandedOrders[order.id]);
                    return (
                      <article key={order.id} className="p-4 sm:p-5">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-gray-900">{order.order_number}</h4>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${order.status === 'submitted' ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
                                {order.status}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-gray-600">
                              {order.session_name || 'Order session'}{order.order_session_id ? ` · #${order.order_session_id}` : ''}
                              {order.session_status ? ` · ${order.session_status}` : ''}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">{formatDateTime(order.ordered_at, timeZone)}</p>
                          </div>
                          <div className="flex items-center justify-between gap-4 sm:justify-end">
                            <p className="text-right">
                              <span className="block text-xs text-gray-500">Order total</span>
                              <span className="font-bold text-gray-900">{formatMoney(order.total_amount)}</span>
                            </p>
                            <button
                              type="button"
                              aria-expanded={expanded}
                              onClick={() => toggleOrder(order.id)}
                              className={secondaryButtonClass}
                            >
                              {expanded ? 'Hide items' : `View ${order.items?.length || 0} items`}
                            </button>
                          </div>
                        </div>

                        {expanded && (
                          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-100">
                            <table className="w-full min-w-[600px] text-left text-sm">
                              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                <tr>
                                  <th scope="col" className="px-4 py-3">Product</th>
                                  <th scope="col" className="px-4 py-3 text-right">Unit price</th>
                                  <th scope="col" className="px-4 py-3 text-right">Quantity</th>
                                  <th scope="col" className="px-4 py-3 text-right">Item subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {(order.items || []).map((item, index) => (
                                  <tr key={item.id ?? `${order.id}-${index}`}>
                                    <td className="px-4 py-3 font-medium text-gray-900">{item.product_name}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{formatMoney(item.unit_price)}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatMoney(item.subtotal)}</td>
                                  </tr>
                                ))}
                                {(!order.items || order.items.length === 0) && (
                                  <tr><td colSpan="4" className="px-4 py-5 text-center text-gray-500">No item snapshots are available.</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
              {!loading && !error && (
                <Pagination
                  currentPage={pagination.currentPage}
                  lastPage={pagination.lastPage}
                  total={pagination.total}
                  onChange={(page) => setQuery((current) => ({ ...current, page }))}
                />
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function MessageModal({ customer, onClose, onSuccess }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [privateChatStatus, setPrivateChatStatus] = useState(() => getPrivateChatStatus(customer));
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');
  const sendingRef = useRef(false);
  const refreshingStatusRef = useRef(false);
  const idempotencyRef = useRef(null);

  const refreshPrivateChatStatus = useCallback(async () => {
    if (refreshingStatusRef.current) return;
    refreshingStatusRef.current = true;
    setRefreshingStatus(true);
    setStatusError('');
    try {
      const response = await api.get(`/admin/customers/${customer.id}/orders`, {
        params: { page: 1, per_page: 1 },
      });
      if (!response.data?.customer || typeof response.data.customer !== 'object') {
        throw new Error('The API returned an invalid customer profile response.');
      }
      const status = getPrivateChatStatus(response.data.customer);
      const deliveryUnavailable = ['blocked', 'unavailable'].includes(error?.kind);
      setPrivateChatStatus(deliveryUnavailable ? 'unavailable' : status);
      if (!deliveryUnavailable && status !== 'unavailable') setError(null);
    } catch (requestError) {
      console.error('Failed to refresh Telegram private-chat status', requestError);
      setStatusError(getApiErrorMessage(requestError, 'Could not refresh private-chat status.'));
    } finally {
      refreshingStatusRef.current = false;
      setRefreshingStatus(false);
    }
  }, [customer.id, error]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshPrivateChatStatus();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => document.removeEventListener('visibilitychange', refreshWhenVisible);
  }, [refreshPrivateChatStatus]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (sendingRef.current) return;
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setError({ kind: 'validation', message: 'Enter a message before sending.' });
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      if (privateChatStatus !== 'enabled') {
        throw new Error(
          privateChatStatus === 'unknown'
            ? 'Private messaging status is not available from the backend. Refresh the customer profile before sending.'
            : 'This customer cannot currently receive private messages. Ask them to start the bot, then refresh their status.'
        );
      }

      if (!idempotencyRef.current || idempotencyRef.current.message !== trimmedMessage) {
        if (!window.crypto?.randomUUID) {
          throw new Error('Secure message submission is unavailable in this browser. Reload the Admin page and try again.');
        }
        idempotencyRef.current = {
          message: trimmedMessage,
          key: window.crypto.randomUUID(),
        };
      }

      const response = await api.post(
        `/admin/customers/${customer.id}/messages`,
        { message: trimmedMessage },
        { headers: { 'Idempotency-Key': idempotencyRef.current.key } }
      );
      if (response.data?.delivered !== true || response.data?.data?.status !== 'sent') {
        const failure = new Error(response.data?.error || response.data?.message || 'The backend did not confirm Telegram accepted the message.');
        failure.response = { data: response.data, status: response.status, headers: response.headers };
        throw failure;
      }
      setPrivateChatStatus('enabled');
      onSuccess(`Message sent to ${getDisplayName(customer)}.`);
      onClose();
    } catch (requestError) {
      console.error('Failed to send Telegram customer message', requestError);
      const failure = getMessageFailure(requestError);
      if (failure.kind === 'not-started') setPrivateChatStatus('not-started');
      if (failure.kind === 'blocked' || failure.kind === 'unavailable') setPrivateChatStatus('unavailable');
      setError(failure);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="send-message-title" className="my-4 w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Telegram message</p>
            <h2 id="send-message-title" className="mt-1 text-xl font-bold text-gray-900">Send a private message</h2>
          </div>
          <button type="button" onClick={onClose} disabled={sending} className={secondaryButtonClass}>Cancel</button>
        </header>

        <div className="mt-5 rounded-xl bg-stone-50 p-4">
          <p className="font-semibold text-gray-900">{getDisplayName(customer)}</p>
          <p className="mt-1 text-sm text-gray-600">
            {customer.telegram_username ? `@${String(customer.telegram_username).replace(/^@/, '')}` : 'No username'}
          </p>
          <p className="mt-1 text-xs text-gray-500">Telegram ID: {customer.telegram_user_id ?? '—'}</p>
          <PrivateChatStatus status={privateChatStatus} />
          <button
            type="button"
            onClick={refreshPrivateChatStatus}
            disabled={refreshingStatus || sending}
            className="mt-2 text-xs font-semibold text-emerald-800 underline disabled:opacity-60"
          >
            {refreshingStatus ? 'Refreshing status…' : 'Refresh activation status'}
          </button>
          {statusError && <p role="alert" className="mt-1 text-xs text-red-700">{statusError}</p>}
        </div>

        {privateChatStatus !== 'enabled' && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {privateChatStatus === 'not-started' ? (
              <>
                <p>This customer must voluntarily open the bot privately and press <strong>Start</strong> before receiving direct messages. They can continue ordering in the Mini App without doing this.</p>
                <a
                  className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-emerald-300 bg-white px-4 py-2 font-semibold text-emerald-800 underline"
                  href="https://t.me/ahseven_bot?start=order_notifications"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Bot Link
                </a>
              </>
            ) : privateChatStatus === 'unavailable' ? (
              <>
                <p>Telegram reported that this bot chat is blocked or unavailable. Ask the customer to unblock the bot and press Start again.</p>
                <a
                  className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-emerald-300 bg-white px-4 py-2 font-semibold text-emerald-800 underline"
                  href="https://t.me/ahseven_bot?start=order_notifications"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Bot Link
                </a>
              </>
            ) : (
              <p>Private messaging status is unavailable. Refresh the customer profile; sending stays disabled until the backend confirms activation.</p>
            )}
          </div>
        )}

        <form onSubmit={sendMessage} className="mt-5 space-y-3">
          <label htmlFor="telegram-customer-message" className="block text-sm font-semibold text-gray-700">Message</label>
          <textarea
            id="telegram-customer-message"
            rows="5"
            maxLength={MESSAGE_LIMIT}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={sending}
            className={inputClass}
            placeholder="Write your message..."
          />
          <p className="text-right text-xs text-gray-500">{message.length}/{MESSAGE_LIMIT}</p>
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p>{error.message}</p>
              {error.kind === 'blocked' && (
                <p className="mt-2">Ask the customer to unblock the bot and start it again. They can continue ordering in the Mini App.</p>
              )}
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={sending} className={secondaryButtonClass}>Cancel</button>
            <button
              type="submit"
              disabled={sending || !message.trim() || privateChatStatus !== 'enabled'}
              className={primaryButtonClass}
            >
              {sending ? 'Sending…' : 'Send Message'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DeactivateDialog({ customer, deleting, error, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6" role="presentation">
      <section role="alertdialog" aria-modal="true" aria-labelledby="deactivate-customer-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-red-700">Confirm deactivation</p>
        <h2 id="deactivate-customer-title" className="mt-1 text-xl font-bold text-gray-900">Deactivate this customer?</h2>
        <p className="mt-4 text-sm leading-6 text-gray-700">
          Deactivate <strong>{getDisplayName(customer)}</strong> (Telegram ID <strong>{customer.telegram_user_id}</strong>)?
          This removes them from the active customer list. Their account and order history are preserved; no permanent deletion will occur.
        </p>
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={deleting} className={secondaryButtonClass}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={deleting} className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-wait disabled:opacity-60">
            {deleting ? 'Deactivating…' : 'Deactivate customer'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function TelegramCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState(normalizePage());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateError, setDateError] = useState('');
  const [timeZone, setTimeZone] = useState('UTC');
  const [query, setQuery] = useState({ dates: null, search: '', page: 1 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [messageCustomer, setMessageCustomer] = useState(null);
  const [deactivateCustomer, setDeactivateCustomer] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');
  const [toast, setToast] = useState('');
  const dateDraftDirty = useRef(false);

  const fetchCustomers = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/admin/customers', {
        params: makeParams(query),
        signal,
      });
      const result = response.data;
      if (!Array.isArray(result?.data)) {
        throw new Error('The API returned an invalid Telegram customers response.');
      }

      const nextPagination = normalizePage(result);
      if (query.page > nextPagination.lastPage) {
        setQuery((current) => ({ ...current, page: nextPagination.lastPage }));
        return;
      }

      setCustomers(result.data);
      setPagination(nextPagination);
      if (result.filters?.timezone) setTimeZone(result.filters.timezone);
      if (!dateDraftDirty.current) {
        setDateFrom(result.filters?.date_from || '');
        setDateTo(result.filters?.date_to || '');
      }
    } catch (requestError) {
      if (requestError.code === 'ERR_CANCELED') return;
      console.error('Failed to load Telegram customers', requestError);
      setError(getApiErrorMessage(requestError, 'Failed to load Telegram customers.'));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const initialFetch = window.setTimeout(() => fetchCustomers(controller.signal), 0);
    return () => {
      window.clearTimeout(initialFetch);
      controller.abort();
    };
  }, [fetchCustomers, refreshKey]);

  useEffect(() => {
    if (search === query.search) return undefined;
    const timer = window.setTimeout(() => {
      setQuery((current) => ({ ...current, search, page: 1 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, query.search]);

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 5000);
  }, []);

  const handleMessageSuccess = useCallback((message) => {
    showToast(message);
    setRefreshKey((current) => current + 1);
  }, [showToast]);

  const applyDateFilter = (event) => {
    event.preventDefault();
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setDateError('From date must be on or before the to date.');
      return;
    }
    setDateError('');
    dateDraftDirty.current = false;
    setQuery((current) => ({
      ...current,
      dates: dateFrom || dateTo ? { from: dateFrom, to: dateTo } : null,
      search,
      page: 1,
    }));
  };

  const setToday = () => {
    dateDraftDirty.current = false;
    setDateError('');
    setDateFrom('');
    setDateTo('');
    setQuery((current) => ({ ...current, dates: null, search, page: 1 }));
  };

  const resetFilters = () => {
    dateDraftDirty.current = false;
    setDateError('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setQuery({ dates: null, search: '', page: 1 });
  };

  const handleDetailEvent = useCallback((event) => {
    if (event.type === 'timezone') setTimeZone(event.value);
    if (event.type === 'open-message') {
      setSelectedCustomer(null);
      setMessageCustomer(event.customer);
    }
  }, []);

  const deactivateSelectedCustomer = async () => {
    if (!deactivateCustomer || deleting) return;
    setDeleting(true);
    setDeactivateError('');
    try {
      const response = await api.delete(`/admin/customers/${deactivateCustomer.id}`);
      if (response.data?.data?.is_active !== false || response.data?.data?.order_history_preserved !== true) {
        throw new Error('The backend did not confirm customer deactivation and preserved order history.');
      }
      showToast(`${getDisplayName(deactivateCustomer)} was deactivated. Order history was preserved.`);
      setDeactivateCustomer(null);
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      console.error('Failed to deactivate Telegram customer', requestError);
      setDeactivateError(getApiErrorMessage(requestError, 'Failed to deactivate the customer. Their data has not been removed.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Customer management</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">Telegram Customers</h1>
        <p className="mt-1 text-sm text-gray-500">Search customer profiles and review order activity from the verified Telegram accounts.</p>
      </header>

      {toast && (
        <div role="status" className="flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p>{toast}</p>
          <button type="button" onClick={() => setToast('')} className="font-semibold" aria-label="Dismiss notification">Dismiss</button>
        </div>
      )}

      <form onSubmit={applyDateFilter} className="grid grid-cols-1 items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <label htmlFor="telegram-customers-date-from" className="mb-1 block text-xs font-semibold text-gray-600">From date</label>
          <input
            id="telegram-customers-date-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => { dateDraftDirty.current = true; setDateFrom(event.target.value); }}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="telegram-customers-date-to" className="mb-1 block text-xs font-semibold text-gray-600">To date</label>
          <input
            id="telegram-customers-date-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => { dateDraftDirty.current = true; setDateTo(event.target.value); }}
            className={inputClass}
          />
        </div>
        <button type="submit" disabled={loading} className={primaryButtonClass}>Apply Filter</button>
        <button type="button" onClick={setToday} disabled={loading} className={secondaryButtonClass}>Today</button>
        <button type="button" onClick={resetFilters} disabled={loading} className={secondaryButtonClass}>Reset</button>
        <div>
          <label htmlFor="telegram-customers-search" className="mb-1 block text-xs font-semibold text-gray-600">Search customers</label>
          <input
            id="telegram-customers-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ID, name, or username"
            className={inputClass}
          />
        </div>
        <p className="text-xs text-gray-500 sm:col-span-2 lg:col-span-6">
          Date ranges are inclusive. Dates and times use the business timezone ({timeZone}); spending excludes cancelled orders.
        </p>
        {dateError && <p role="alert" className="text-sm text-red-700 sm:col-span-2 lg:col-span-6">{dateError}</p>}
      </form>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{error}</p>
          <button type="button" onClick={() => setRefreshKey((current) => current + 1)} className="mt-2 font-semibold underline">Retry</button>
        </div>
      )}

      <section aria-label="Telegram customers" className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div aria-label="Loading customers" className="space-y-3 p-5">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-gray-100" />)}
          </div>
        ) : error ? null : customers.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="font-semibold text-gray-800">No Telegram customers found</p>
            <p className="mt-1 text-sm text-gray-500">Customers with orders matching the selected dates and search will appear here.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">No.</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Telegram profile</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Username</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Telegram ID</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Private messaging</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Orders</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Total spending</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Latest order</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {customers.map((customer, index) => (
                    <tr key={customer.id} className="align-top hover:bg-gray-50">
                      <td className="px-4 py-4 text-gray-500">{(pagination.currentPage - 1) * pagination.perPage + index + 1}</td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-gray-900">{getDisplayName(customer)}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {[customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.display_name || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-gray-700">
                        {customer.telegram_username
                          ? `@${String(customer.telegram_username).replace(/^@/, '')}`
                          : 'No username'}
                      </td>
                      <td className="px-4 py-4 font-mono text-gray-700">{customer.telegram_user_id ?? '—'}</td>
                      <td className="px-4 py-4">
                        <PrivateChatStatus status={getPrivateChatStatus(customer)} />
                      </td>
                      <td className="px-4 py-4 text-right text-gray-700">{customer.order_count ?? 0}</td>
                      <td className="px-4 py-4 text-right font-semibold text-emerald-700">{formatMoney(customer.total_spending)}</td>
                      <td className="px-4 py-4 text-gray-700">{formatDateTime(customer.latest_order_at, timeZone)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => setSelectedCustomer(customer)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100">
                            View Details
                          </button>
                          <button type="button" onClick={() => setMessageCustomer(customer)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100">
                            Send Message
                          </button>
                          <button type="button" onClick={() => { setDeactivateError(''); setDeactivateCustomer(customer); }} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 transition hover:bg-red-100">
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={pagination.currentPage}
              lastPage={pagination.lastPage}
              total={pagination.total}
              onChange={(page) => setQuery((current) => ({ ...current, page }))}
            />
          </>
        )}
      </section>

      {selectedCustomer && (
        <CustomerModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          timeZone={timeZone}
          onMessageSent={handleDetailEvent}
        />
      )}
      {messageCustomer && (
        <MessageModal
          customer={messageCustomer}
          onClose={() => setMessageCustomer(null)}
          onSuccess={handleMessageSuccess}
        />
      )}
      {deactivateCustomer && (
        <DeactivateDialog
          customer={deactivateCustomer}
          deleting={deleting}
          error={deactivateError}
          onCancel={() => setDeactivateCustomer(null)}
          onConfirm={deactivateSelectedCustomer}
        />
      )}
    </main>
  );
}
