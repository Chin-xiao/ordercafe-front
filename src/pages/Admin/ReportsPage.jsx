import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import { formatRiel } from '../../utils/currency';
import { unwrapApiData } from '../../utils/orderSession';

const PAGE_SIZE = 15;

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100';
const secondaryButtonClass = 'rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60';
const primaryButtonClass = 'rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60';

const getPagination = (response) => ({
  currentPage: Number(response?.current_page) || 1,
  lastPage: Math.max(1, Number(response?.last_page) || 1),
  total: Number(response?.total) || 0,
});

const formatOrderTime = (value, timeZone) => {
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

function Pagination({ page, lastPage, total, loading, onChange }) {
  if (total === 0) return null;

  return (
    <nav aria-label="Order report pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm">
      <p className="text-gray-500">Page {page} of {lastPage} · {total} orders</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={loading || page <= 1}
          className={secondaryButtonClass}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={loading || page >= lastPage}
          className={secondaryButtonClass}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

function OrderCard({ order, timeZone }) {
  const customerName = order.customer_name
    || [order.first_name, order.last_name].filter(Boolean).join(' ')
    || 'Name not available';

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-gray-100 bg-stone-50 p-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Customer</p>
          <h2 className="text-base font-bold text-gray-900">{customerName}</h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
            <span>Telegram ID: {order.telegram_user_id ?? '—'}</span>
            {order.telegram_username && <span>{order.telegram_username}</span>}
          </div>
        </div>
        <div className="text-xs text-gray-600 sm:text-right">
          <p><span className="font-semibold text-gray-800">Order time:</span> {formatOrderTime(order.ordered_at, timeZone)}</p>
          <p className="mt-1"><span className="font-semibold text-gray-800">Session:</span> {order.session_name || '—'}</p>
          <p className="mt-1 flex items-center gap-2 sm:justify-end">
            <span className="font-mono text-gray-500">{order.order_number || `#${order.id}`}</span>
            <span className="rounded-full bg-gray-200 px-2 py-0.5 font-semibold capitalize text-gray-700">{order.status}</span>
          </p>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-white text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold sm:px-5">Drink</th>
              <th scope="col" className="px-3 py-3 font-semibold">Sugar</th>
              <th scope="col" className="px-3 py-3 text-center font-semibold">Qty</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Unit price</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold sm:px-5">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(order.items || []).map((item, index) => (
              <tr key={`${item.product_id || item.product_name}-${item.sugar_percent}-${index}`}>
                <td className="px-4 py-3 font-medium text-gray-900 sm:px-5">{item.product_name}</td>
                <td className="px-3 py-3 text-gray-700">
                  {item.sugar_percent === null || item.sugar_percent === undefined ? '—' : `${item.sugar_percent}%`}
                </td>
                <td className="px-3 py-3 text-center text-gray-700">{item.quantity}</td>
                <td className="px-3 py-3 text-right text-gray-700">{formatRiel(item.unit_price)}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900 sm:px-5">{formatRiel(item.subtotal)}</td>
              </tr>
            ))}
            {(!order.items || order.items.length === 0) && (
              <tr>
                <td colSpan="5" className="px-5 py-5 text-center text-sm text-gray-500">No item details were returned for this order.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm sm:px-5">
        <span className="font-bold text-gray-800">Order total</span>
        <span className="text-base font-bold text-emerald-700">{formatRiel(order.total_amount)}</span>
      </footer>
    </article>
  );
}

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState('');
  const [businessToday, setBusinessToday] = useState('');
  const [timeZone, setTimeZone] = useState('UTC');
  const [sessions, setSessions] = useState([]);
  const [sessionError, setSessionError] = useState('');
  const [query, setQuery] = useState(null);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');
  const [productsError, setProductsError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [initialRetry, setInitialRetry] = useState(0);
  const [reportRetry, setReportRetry] = useState(0);
  const [productsRetry, setProductsRetry] = useState(0);
  const reportFrom = query?.from || '';
  const reportTo = query?.to || '';
  const hasQuery = query !== null;

  useEffect(() => {
    const controller = new AbortController();

    const initialize = async () => {
      setInitializing(true);
      setLoading(true);
      setError('');
      const [defaultsResult, sessionsResult] = await Promise.allSettled([
        api.get('/admin/reports/daily-orders', {
          params: { per_page: 1 },
          signal: controller.signal,
        }),
        api.get('/admin/order-sessions', { signal: controller.signal }),
      ]);

      if (controller.signal.aborted) return;

      if (sessionsResult.status === 'fulfilled') {
        const sessionList = unwrapApiData(sessionsResult.value);
        if (Array.isArray(sessionList)) {
          setSessions(sessionList);
          setSessionError('');
        } else {
          setSessionError('The API returned an invalid order session list.');
        }
      } else {
        console.error('Failed to load order sessions for report filters', sessionsResult.reason);
        setSessionError(getApiErrorMessage(sessionsResult.reason, 'Unable to load session filters.'));
      }

      if (defaultsResult.status === 'rejected') {
        console.error('Failed to load report defaults', defaultsResult.reason);
        setError(getApiErrorMessage(defaultsResult.reason, 'Unable to load the business date for this report.'));
        setInitializing(false);
        setLoading(false);
        return;
      }

      const filters = defaultsResult.value.data?.filters;
      if (!filters?.date_from || !filters?.date_to || !filters?.timezone) {
        setError('The API did not provide the business date and timezone required to initialize the report.');
        setInitializing(false);
        setLoading(false);
        return;
      }

      setBusinessToday(filters.date_from);
      setTimeZone(filters.timezone);
      setDateFrom(filters.date_from);
      setDateTo(filters.date_to);
      setQuery({
        from: filters.date_from,
        to: filters.date_to,
        search: '',
        sessionId: '',
        status: '',
        page: 1,
      });
      setInitializing(false);
    };

    initialize();
    return () => controller.abort();
  }, [initialRetry]);

  useEffect(() => {
    if (!query) return undefined;

    const controller = new AbortController();
    const loadReport = async () => {
      setLoading(true);
      setError('');
      const params = { page: query.page, per_page: PAGE_SIZE };
      if (query.from) params.date_from = query.from;
      if (query.to) params.date_to = query.to;
      if (query.search.trim()) params.search = query.search.trim().replace(/^@/, '');
      if (query.sessionId) params.order_session_id = query.sessionId;
      if (query.status) params.status = query.status;

      try {
        const response = await api.get('/admin/orders', { params, signal: controller.signal });
        const result = response.data;
        if (!Array.isArray(result?.data) || !result.summary || typeof result.summary !== 'object') {
          throw new Error('The API returned an invalid detailed order report response.');
        }
        const nextPagination = getPagination(result);
        if (query.page > nextPagination.lastPage) {
          setQuery((current) => current && ({ ...current, page: nextPagination.lastPage }));
          return;
        }
        setOrders(result.data);
        setSummary(result.summary);
        setPagination(nextPagination);
      } catch (requestError) {
        if (requestError.code === 'ERR_CANCELED') return;
        console.error('Failed to load detailed order report', requestError);
        setError(getApiErrorMessage(requestError, 'Failed to load the detailed order report.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadReport();
    return () => controller.abort();
  }, [query, reportRetry]);

  useEffect(() => {
    if (!hasQuery) return undefined;

    const controller = new AbortController();
    const loadTopProducts = async () => {
      setProductsError('');
      const params = {};
      if (reportFrom) params.date_from = reportFrom;
      if (reportTo) params.date_to = reportTo;

      try {
        const response = await api.get('/admin/reports/products', { params, signal: controller.signal });
        const products = unwrapApiData(response);
        if (!Array.isArray(products)) {
          throw new Error('The API returned an invalid product report response.');
        }
        setTopProducts(products);
      } catch (requestError) {
        if (requestError.code === 'ERR_CANCELED') return;
        console.error('Failed to load top-selling products', requestError);
        setProductsError(getApiErrorMessage(requestError, 'Failed to load top-selling products.'));
      }
    };

    loadTopProducts();
    return () => controller.abort();
  }, [hasQuery, reportFrom, reportTo, productsRetry]);

  const applyFilters = (event) => {
    event.preventDefault();
    if (dateFrom && dateTo && dateTo < dateFrom) {
      setFilterError('The end date must be on or after the start date.');
      return;
    }

    setFilterError('');
    setQuery({
      from: dateFrom,
      to: dateTo,
      search,
      sessionId,
      status,
      page: 1,
    });
  };

  const applyToday = () => {
    setDateFrom(businessToday);
    setDateTo(businessToday);
    setFilterError('');
    setQuery((current) => ({
      from: businessToday,
      to: businessToday,
      search: current?.search || '',
      sessionId: current?.sessionId || '',
      status: current?.status || '',
      page: 1,
    }));
  };

  const resetFilters = () => {
    setDateFrom(businessToday);
    setDateTo(businessToday);
    setSearch('');
    setSessionId('');
    setStatus('');
    setFilterError('');
    setQuery({
      from: businessToday,
      to: businessToday,
      search: '',
      sessionId: '',
      status: '',
      page: 1,
    });
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Cafe analytics</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">Daily order report</h1>
        <p className="mt-1 text-sm text-gray-500">
          Customer orders and saved item prices, filtered by the business timezone ({timeZone}).
        </p>
      </header>

      <form
        onSubmit={applyFilters}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
      >
        <div>
          <label htmlFor="report-date-from" className="mb-1 block text-xs font-semibold text-gray-600">From date</label>
          <input
            id="report-date-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => setDateFrom(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="report-date-to" className="mb-1 block text-xs font-semibold text-gray-600">To date</label>
          <input
            id="report-date-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => setDateTo(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="report-customer-search" className="mb-1 block text-xs font-semibold text-gray-600">Customer search</label>
          <input
            id="report-customer-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, username, Telegram ID"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="report-session" className="mb-1 block text-xs font-semibold text-gray-600">Session</label>
          <select
            id="report-session"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            disabled={Boolean(sessionError)}
            className={inputClass}
          >
            <option value="">All sessions</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>{session.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="report-status" className="mb-1 block text-xs font-semibold text-gray-600">Status</label>
          <select
            id="report-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={inputClass}
          >
            <option value="">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" disabled={loading || initializing} className={primaryButtonClass}>
            Apply Filter
          </button>
          <button type="button" onClick={applyToday} disabled={loading || initializing} className={secondaryButtonClass}>
            Today
          </button>
          <button type="button" onClick={resetFilters} disabled={loading || initializing} className={secondaryButtonClass}>
            Reset
          </button>
          {filterError && <p role="alert" className="w-full text-sm text-red-700">{filterError}</p>}
          {sessionError && <p role="alert" className="w-full text-sm text-amber-800">Session filter unavailable: {sessionError}</p>}
        </div>
      </form>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => (query ? setReportRetry((value) => value + 1) : setInitialRetry((value) => value + 1))}
            className="mt-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {initializing || loading ? (
        <section aria-label="Loading report" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-white p-5">
              <div className="h-3 w-28 rounded bg-gray-200" />
              <div className="mt-4 h-7 w-32 rounded bg-gray-200" />
            </div>
          ))}
        </section>
      ) : !error && (
        <>
          <section aria-label="Filtered order summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Total orders</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{Number(summary?.total_orders) || 0}</p>
            </article>
            <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Total drinks ordered</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{Number(summary?.total_items) || 0}</p>
            </article>
            <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Total sales</p>
              <p className="mt-2 text-3xl font-bold text-emerald-700">{formatRiel(summary?.total_sales)}</p>
            </article>
            <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Customers who ordered</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{Number(summary?.total_customers) || 0}</p>
            </article>
          </section>

          <section aria-label="Customer orders" className="space-y-4">
            {orders.map((order) => <OrderCard key={order.id} order={order} timeZone={timeZone} />)}
            {orders.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white px-5 py-12 text-center">
                <h2 className="font-semibold text-gray-800">No orders found</h2>
                <p className="mt-1 text-sm text-gray-500">No customer orders match the selected filters.</p>
              </div>
            )}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <Pagination
                page={pagination.currentPage}
                lastPage={pagination.lastPage}
                total={pagination.total}
                loading={loading}
                onChange={(page) => setQuery((current) => current && ({ ...current, page }))}
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-bold text-gray-900">Top-selling products</h2>
              <p className="mt-1 text-xs text-gray-500">
                Product totals for the selected date range, as returned by Laravel.
              </p>
            </div>
            {productsError && (
              <div role="alert" className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800">
                {productsError}
                <button
                  type="button"
                  onClick={() => setProductsRetry((value) => value + 1)}
                  className="ml-2 font-semibold underline"
                >
                  Retry
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">Product</th>
                    <th scope="col" className="px-5 py-3 text-center font-semibold">Quantity sold</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {topProducts.map((item, index) => (
                    <tr key={item.product_id ?? item.id ?? `${item.product_name}-${index}`} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{item.product_name}</td>
                      <td className="px-5 py-3 text-center text-gray-600">{item.total_quantity}</td>
                      <td className="px-5 py-3 text-right font-semibold text-emerald-700">{formatRiel(item.total_revenue)}</td>
                    </tr>
                  ))}
                  {topProducts.length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-5 py-10 text-center text-sm text-gray-500">
                        No product sales match this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
