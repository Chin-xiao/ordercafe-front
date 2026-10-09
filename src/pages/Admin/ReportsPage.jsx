import React, { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';

const unwrapData = (response) => response?.data?.data ?? response?.data;

export default function ReportsPage() {
  const [salesData, setSalesData] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDates, setAppliedDates] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterError, setFilterError] = useState('');

  const fetchReports = useCallback(async (dates = { from: '', to: '' }) => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (dates.from) params.date_from = dates.from;
      if (dates.to) params.date_to = dates.to;

      const [salesResponse, productsResponse] = await Promise.all([
        api.get('/admin/reports/sales', { params }),
        api.get('/admin/reports/products', { params }),
      ]);

      const sales = unwrapData(salesResponse);
      const products = unwrapData(productsResponse);
      if (!sales || typeof sales !== 'object' || Array.isArray(sales) || !Array.isArray(products)) {
        throw new Error('The API returned an invalid sales or product report response.');
      }
      setSalesData(sales);
      setTopProducts(products);
    } catch (err) {
      console.error('Failed to load report analytics', err);
      setSalesData(null);
      setTopProducts([]);
      setError(getApiErrorMessage(err, 'Failed to load report analytics.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => fetchReports({ from: '', to: '' }), 0);
    return () => window.clearTimeout(initialFetch);
  }, [fetchReports]);

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    if (dateFrom && dateTo && dateTo < dateFrom) {
      setFilterError('The end date must be on or after the start date.');
      return;
    }

    setFilterError('');
    const dates = { from: dateFrom, to: dateTo };
    setAppliedDates(dates);
    fetchReports(dates);
  };

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setFilterError('');
    const dates = { from: '', to: '' };
    setAppliedDates(dates);
    fetchReports(dates);
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Cafe analytics</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">Sales &amp; product reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Summary data from the existing Laravel reporting endpoints.
        </p>
      </header>

      <form
        onSubmit={handleFilterSubmit}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:gap-4"
      >
        <div>
          <label htmlFor="report-date-from" className="mb-1 block text-xs font-semibold text-gray-600">From date</label>
          <input
            id="report-date-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
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
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? 'Loading reports…' : 'Apply filter'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={loading && !appliedDates.from && !appliedDates.to}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          Reset filter
        </button>
        {filterError && <p role="alert" className="w-full text-sm text-red-700">{filterError}</p>}
      </form>

      <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        These existing report routes provide aggregate sales and product data, not order-level Telegram customer records.
        The selected dates are sent as `date_from` and `date_to` in `YYYY-MM-DD` format. The backend’s timezone and
        inclusive end-date behavior need confirmation before this can be described as a verified inclusive date range.
      </aside>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{error}</p>
          <button onClick={() => fetchReports(appliedDates)} className="mt-2 font-semibold underline">Retry</button>
        </div>
      )}

      {loading ? (
        <section aria-label="Loading report" className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-white p-5">
              <div className="h-3 w-24 rounded bg-gray-200" />
              <div className="mt-4 h-7 w-32 rounded bg-gray-200" />
            </div>
          ))}
        </section>
      ) : !error ? (
        <>
          <section aria-label="Sales summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Total revenue</p>
              <p className="mt-2 text-3xl font-bold text-emerald-700">
                ${Number(salesData?.total_revenue || 0).toFixed(2)}
              </p>
            </article>
            <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Orders placed</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{salesData?.total_orders ?? 0}</p>
            </article>
            <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Customers</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{salesData?.total_customers ?? 0}</p>
            </article>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-bold text-gray-900">Top-selling products</h2>
              <p className="mt-1 text-xs text-gray-500">Aggregated product totals returned by Laravel.</p>
            </div>
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
                      <td className="px-5 py-3 text-right font-semibold text-emerald-700">
                        ${Number(item.total_revenue).toFixed(2)}
                      </td>
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
      ) : null}
    </main>
  );
}
