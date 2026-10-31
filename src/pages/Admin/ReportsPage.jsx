// src/pages/Admin/ReportsPage.jsx
import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import { formatRiel } from '../../utils/currency';
import { unwrapApiData } from '../../utils/orderSession';
import {
  Icon,
  PageHeader,
  Card,
  StatCard,
  Button,
  Badge,
  EmptyState,
  tableWrap,
  table,
  th,
  td,
  tr,
  input,
} from '../../components/ui';
import CoffeeLoader from '../../components/CoffeeLoader';

const PAGE_SIZE = 15;

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
    <nav
      aria-label="Order report pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-5 py-3.5 text-sm"
    >
      <p className="text-xs text-stone-500">
        Page {page} of {lastPage} · {total} orders
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => onChange(page - 1)}
          disabled={loading || page <= 1}
          className="min-h-[36px] px-3 py-1.5 text-xs"
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          onClick={() => onChange(page + 1)}
          disabled={loading || page >= lastPage}
          className="min-h-[36px] px-3 py-1.5 text-xs"
        >
          Next
        </Button>
      </div>
    </nav>
  );
}

function OrderCard({ order, timeZone }) {
  const customerName =
    order.customer_name ||
    [order.first_name, order.last_name].filter(Boolean).join(' ') ||
    'Name not available';

  const statusTone =
    order.status === 'submitted' ? 'green' : order.status === 'cancelled' ? 'red' : 'gray';

  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-stone-100 bg-stone-50/60 p-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#ef5a3c]">Customer</p>
          <h2 className="text-base font-bold text-stone-900">{customerName}</h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
            <span>Telegram ID: {order.telegram_user_id ?? '—'}</span>
            {order.telegram_username && <span>@{order.telegram_username.replace(/^@/, '')}</span>}
          </div>
        </div>
        <div className="space-y-1 text-xs text-stone-600 sm:text-right">
          <div>
            <span className="font-semibold text-stone-800">Order time:</span>{' '}
            {formatOrderTime(order.ordered_at, timeZone)}
          </div>
          <div>
            <span className="font-semibold text-stone-800">Session:</span>{' '}
            {order.session_name || '—'}
          </div>
          <div className="flex items-center gap-2 sm:justify-end">
            <span className="font-mono text-xs text-stone-500">
              {order.order_number || `#${order.id}`}
            </span>
            <Badge tone={statusTone}>{order.status}</Badge>
          </div>
        </div>
      </header>

      <div className={tableWrap}>
        <table className={table}>
          <thead>
            <tr>
              <th scope="col" className={th}>Drink</th>
              <th scope="col" className={th}>Sugar</th>
              <th scope="col" className={`${th} text-center`}>Qty</th>
              <th scope="col" className={`${th} text-right`}>Unit price</th>
              <th scope="col" className={`${th} text-right`}>Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {(order.items || []).map((item, index) => (
              <tr
                key={`${item.product_id || item.product_name}-${item.sugar_percent}-${index}`}
                className={tr}
              >
                <td className={`${td} font-medium text-stone-900`}>{item.product_name}</td>
                <td className={td}>
                  {item.sugar_percent === null || item.sugar_percent === undefined
                    ? '—'
                    : `${item.sugar_percent}%`}
                </td>
                <td className={`${td} text-center text-stone-700`}>{item.quantity}</td>
                <td className={`${td} text-right text-stone-700`}>{formatRiel(item.unit_price)}</td>
                <td className={`${td} text-right font-semibold text-stone-900`}>
                  {formatRiel(item.subtotal)}
                </td>
              </tr>
            ))}
            {(!order.items || order.items.length === 0) && (
              <tr>
                <td colSpan="5" className="px-5 py-5 text-center text-sm text-stone-500">
                  No item details were returned for this order.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="flex items-center justify-between border-t border-stone-100 px-4 py-3 text-sm sm:px-5">
        <span className="font-bold text-stone-800">Order total</span>
        <span className="text-base font-bold text-stone-900">{formatRiel(order.total_amount)}</span>
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
          setQuery((current) => current && { ...current, page: nextPagination.lastPage });
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

  if (initializing) {
    return (
      <CoffeeLoader
        fullScreen={false}
        title="Brewing sales reports"
        message="Fetching sales metrics and daily orders."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales reports"
        description={`Customer orders and performance metrics, filtered by business timezone (${timeZone}).`}
      >
        <Button
          variant="secondary"
          icon="filter"
          onClick={applyToday}
          disabled={loading || initializing}
          className="min-h-[40px]"
        >
          Today
        </Button>
      </PageHeader>

      {/* Filter Card */}
      <Card
        title="Filter orders"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={resetFilters}
              disabled={loading || initializing}
              className="min-h-[32px] px-2.5 py-1 text-xs"
            >
              Reset
            </Button>
            <Button
              variant="secondary"
              onClick={applyToday}
              disabled={loading || initializing}
              className="min-h-[32px] px-2.5 py-1 text-xs"
            >
              Today
            </Button>
          </div>
        }
      >
        <form onSubmit={applyFilters} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label
                htmlFor="report-date-from"
                className="mb-1 block text-xs font-semibold text-stone-600"
              >
                From date
              </label>
              <input
                id="report-date-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => setDateFrom(event.target.value)}
                className={input}
              />
            </div>
            <div>
              <label
                htmlFor="report-date-to"
                className="mb-1 block text-xs font-semibold text-stone-600"
              >
                To date
              </label>
              <input
                id="report-date-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
                className={input}
              />
            </div>
            <div>
              <label
                htmlFor="report-customer-search"
                className="mb-1 block text-xs font-semibold text-stone-600"
              >
                Customer search
              </label>
              <input
                id="report-customer-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, username, ID"
                className={input}
              />
            </div>
            <div>
              <label
                htmlFor="report-session"
                className="mb-1 block text-xs font-semibold text-stone-600"
              >
                Session
              </label>
              <select
                id="report-session"
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
                disabled={Boolean(sessionError)}
                className={input}
              >
                <option value="">All sessions</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="report-status"
                className="mb-1 block text-xs font-semibold text-stone-600"
              >
                Status
              </label>
              <select
                id="report-status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={input}
              >
                <option value="">All statuses</option>
                <option value="submitted">Submitted</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3">
            <div className="space-y-1">
              {filterError && (
                <p role="alert" className="text-xs font-medium text-rose-600">
                  {filterError}
                </p>
              )}
              {sessionError && (
                <p role="alert" className="text-xs font-medium text-amber-600">
                  Session filter unavailable: {sessionError}
                </p>
              )}
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || initializing}
              className="min-h-[40px]"
            >
              {loading ? 'Filtering…' : 'Apply filter'}
            </Button>
          </div>
        </form>
      </Card>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <Icon name="close" size={18} className="shrink-0 text-rose-500" />
            <p>{error}</p>
          </div>
          <Button
            variant="secondary"
            className="self-start sm:self-auto min-h-[36px] px-3 py-1.5 text-xs"
            onClick={() =>
              query
                ? setReportRetry((value) => value + 1)
                : setInitialRetry((value) => value + 1)
            }
          >
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <section
          aria-label="Loading report"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="h-3 w-28 rounded bg-stone-100" />
              <div className="mt-4 h-7 w-32 rounded bg-stone-100" />
            </div>
          ))}
        </section>
      ) : (
        !error && (
          <>
            {/* Summary Statistics */}
            <section
              aria-label="Filtered order summary"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <StatCard
                label="Total orders"
                value={Number(summary?.total_orders) || 0}
                hint="Orders in selected range"
                icon="receipt"
                tone="blue"
              />
              <StatCard
                label="Total drinks ordered"
                value={Number(summary?.total_items) || 0}
                hint="Drinks and items served"
                icon="cup"
                tone="amber"
              />
              <StatCard
                label="Total sales"
                value={formatRiel(summary?.total_sales)}
                hint="Gross revenue"
                icon="coins"
                tone="green"
              />
              <StatCard
                label="Customers who ordered"
                value={Number(summary?.total_customers) || 0}
                hint="Unique customer count"
                icon="users"
                tone="rose"
              />
            </section>

            {/* Customer Orders */}
            <section aria-label="Customer orders" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-stone-900">Customer orders</h2>
                <span className="text-xs text-stone-500">
                  {pagination.total} {pagination.total === 1 ? 'order' : 'orders'} found
                </span>
              </div>

              {orders.map((order) => (
                <OrderCard key={order.id} order={order} timeZone={timeZone} />
              ))}

              {orders.length === 0 && (
                <Card padded={true}>
                  <EmptyState
                    icon="receipt"
                    title="No orders found"
                    description="No customer orders match the selected filters."
                    action={
                      <Button variant="secondary" onClick={resetFilters}>
                        Reset filters
                      </Button>
                    }
                  />
                </Card>
              )}

              {orders.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                  <Pagination
                    page={pagination.currentPage}
                    lastPage={pagination.lastPage}
                    total={pagination.total}
                    loading={loading}
                    onChange={(page) =>
                      setQuery((current) => current && { ...current, page })
                    }
                  />
                </div>
              )}
            </section>

            {/* Top-selling Products */}
            <Card
              title="Top-selling products"
              action={
                <span className="text-xs text-stone-500">For selected date range</span>
              }
              padded={false}
            >
              {productsError && (
                <div
                  role="alert"
                  className="flex items-center justify-between border-b border-rose-100 bg-rose-50 px-5 py-3 text-xs text-rose-800"
                >
                  <p>{productsError}</p>
                  <Button
                    variant="secondary"
                    className="min-h-[28px] px-2.5 py-0.5 text-xs"
                    onClick={() => setProductsRetry((value) => value + 1)}
                  >
                    Retry
                  </Button>
                </div>
              )}
              <div className={tableWrap}>
                <table className={table}>
                  <thead>
                    <tr>
                      <th scope="col" className={th}>Product</th>
                      <th scope="col" className={`${th} text-center`}>Quantity sold</th>
                      <th scope="col" className={`${th} text-right`}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {topProducts.map((item, index) => (
                      <tr
                        key={item.product_id ?? item.id ?? `${item.product_name}-${index}`}
                        className={tr}
                      >
                        <td className={`${td} font-medium text-stone-900`}>{item.product_name}</td>
                        <td className={`${td} text-center text-stone-700`}>{item.total_quantity}</td>
                        <td className={`${td} text-right font-semibold text-stone-900`}>
                          {formatRiel(item.total_revenue)}
                        </td>
                      </tr>
                    ))}
                    {topProducts.length === 0 && (
                      <tr>
                        <td colSpan="3" className="px-5 py-10 text-center text-sm text-stone-500">
                          No product sales match this date range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )
      )}
    </div>
  );
}
