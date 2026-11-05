import React, { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import { formatRiel } from '../../utils/currency';
import { Icon, Skeleton, SkeletonStyles } from '../../components/ui';
import BottomTabs from '../../components/miniapp/BottomTabs';

const RANGES = [
  { id: 'week', label: 'Week', title: 'this week' },
  { id: 'month', label: 'Month', title: 'this month' },
  { id: 'all', label: 'All time', title: 'in total' },
];

export default function SpendingPage() {
  const [range, setRange] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (nextRange, signal) => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/mini-app/spending', { params: { range: nextRange }, signal });
      setData(res.data?.data ?? res.data ?? null);
    } catch (err) {
      if (signal?.aborted || err.code === 'ERR_CANCELED') return;
      setError(getApiErrorMessage(err, 'Could not load your spending.'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(range, controller.signal);
    return () => controller.abort();
  }, [range, load]);

  const daily = Array.isArray(data?.daily) ? data.daily : [];
  const categories = Array.isArray(data?.by_category) ? data.by_category : [];
  const topItems = Array.isArray(data?.top_items) ? data.top_items : [];
  const total = Number(data?.total ?? 0);
  const orders = Number(data?.orders_count ?? 0);
  const average = orders > 0 ? Math.round(total / orders) : 0;
  const maxDay = Math.max(1, ...daily.map((d) => Number(d.total) || 0));
  const categoryTotal = categories.reduce((sum, c) => sum + (Number(c.total) || 0), 0) || 1;
  const current = RANGES.find((r) => r.id === range);
  const showEvery = daily.length > 10 ? Math.ceil(daily.length / 6) : 1;
  const firstLoad = loading && !data;

  return (
    <div className="min-h-screen bg-[#f6f4f1] pb-28 text-stone-800">
      <SkeletonStyles />

      <header className="bg-gradient-to-b from-[#fcd9cb] via-[#fdeae2] to-[#f6f4f1] px-4 pb-6 pt-6">
        <h1 className="text-center text-lg font-bold text-stone-900">Money track</h1>
        <p className="mt-1 text-center text-sm text-stone-600">What you ordered, and when</p>

        <div role="tablist" aria-label="Time range" className="mx-auto mt-5 flex max-w-sm rounded-full bg-white/70 p-1 ring-1 ring-white">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={range === r.id}
              onClick={() => setRange(r.id)}
              className={`min-h-10 flex-1 rounded-full text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] ${
                range === r.id ? 'bg-[#1f1a17] text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <main className={`mx-auto max-w-3xl space-y-5 px-4 transition-opacity ${loading && data ? 'opacity-60' : ''}`}>
        {error && (
          <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => load(range)}
              className="min-h-11 self-start rounded-xl border border-amber-300 bg-white px-4 font-semibold hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c]"
            >
              Try again
            </button>
          </div>
        )}

        {firstLoad ? (
          <div role="status" aria-busy="true" className="space-y-4">
            <span className="sr-only">Loading your spending…</span>
            <Skeleton className="h-52 !rounded-3xl" />
            <Skeleton className="h-32 !rounded-3xl" />
          </div>
        ) : data && (
          <>
            {/* Total + chart */}
            <section className="rounded-3xl bg-[#1f1a17] p-5 text-white shadow-lg shadow-black/10">
              <p className="text-sm text-stone-400">Ordered {current.title}</p>
              <p className="mt-1 text-3xl font-bold tracking-tight">{formatRiel(total)}</p>
              <p className="mt-1 text-sm text-stone-400">
                {orders === 1 ? '1 order' : `${orders} orders`}{orders > 0 && ` · average ${formatRiel(average)}`}
              </p>

              {daily.length > 0 && total > 0 ? (
                <div className="mt-6" role="img" aria-label={`Bar chart of what you ordered ${current.title}`}>
                  <div className="flex h-28 items-end gap-1.5">
                    {daily.map((d, i) => (
                      <div key={d.date || d.label || i} className="flex h-full flex-1 items-end">
                        <div
                          title={`${d.label}: ${formatRiel(d.total)}`}
                          className="w-full rounded-t-md bg-[#ef5a3c]"
                          style={{ height: `${Math.max(4, ((Number(d.total) || 0) / maxDay) * 100)}%`, opacity: Number(d.total) > 0 ? 1 : 0.25 }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    {daily.map((d, i) => (
                      <span key={d.date || d.label || i} className="flex-1 truncate text-center text-[11px] text-stone-500">
                        {i % showEvery === 0 ? d.label : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-5 rounded-2xl bg-white/5 p-4 text-center text-sm text-stone-400">No orders {current.title} yet.</p>
              )}
            </section>

            {/* By category */}
            {categories.length > 0 && (
              <section aria-label="By category" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200/60">
                <h2 className="text-sm font-bold text-stone-900">By category</h2>
                <ul className="mt-3 space-y-3">
                  {categories.map((c) => {
                    const pct = Math.round(((Number(c.total) || 0) / categoryTotal) * 100);
                    return (
                      <li key={c.name}>
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="font-medium text-stone-800">{c.name}</span>
                          <span className="text-stone-500">{formatRiel(c.total)} · {pct}%</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100">
                          <div className="h-full rounded-full bg-[#ef5a3c]" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Top items */}
            {topItems.length > 0 && (
              <section aria-label="Top items" className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200/60">
                <h2 className="px-5 pt-5 text-sm font-bold text-stone-900">Your top items</h2>
                <ol className="mt-2 divide-y divide-stone-100">
                  {topItems.map((item, i) => (
                    <li key={item.name} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff1ed] text-xs font-bold text-[#d4401f]">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">{item.name}</span>
                      <span className="text-sm text-stone-500">× {item.quantity}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <p className="flex items-start gap-2 px-1 text-xs text-stone-500">
              <span className="mt-0.5 shrink-0"><Icon name="check" size={12} /></span>
              Totals show what you ordered. Cancelled orders are not counted.
            </p>
          </>
        )}
      </main>

      <BottomTabs />
    </div>
  );
}