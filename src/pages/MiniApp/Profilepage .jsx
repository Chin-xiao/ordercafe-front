import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import { formatRiel } from '../../utils/currency';
import { Icon, Skeleton, SkeletonStyles } from '../../components/ui';
import BottomTabs from '../../components/miniapp/BottomTabs';

const BOT_LINK = 'https://t.me/ahseven_bot?start=order_notifications';

const STATUS = {
  pending: { label: 'Pending', cls: 'bg-sky-50 text-sky-700 ring-sky-600/20' },
  preparing: { label: 'Preparing', cls: 'bg-amber-50 text-amber-800 ring-amber-600/20' },
  completed: { label: 'Confirmed', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  cancelled: { label: 'Cancelled', cls: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
};
function statusOf(status) {
  const v = status?.toLowerCase();
  if (v === 'completed' || v === 'success') return STATUS.completed;
  if (v === 'preparing') return STATUS.preparing;
  if (v === 'cancelled') return STATUS.cancelled;
  return STATUS.pending;
}

function telegramUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  } catch {
    return null;
  }
}

function Avatar({ user, name }) {
  const [failed, setFailed] = useState(false);
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'A';
  return (
    <span className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-[#ef5a3c] text-3xl font-bold text-white ring-[6px] ring-white/70 shadow-lg shadow-[#ef5a3c]/20">
      {user?.photo_url && !failed ? (
        <img src={user.photo_url} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        letters
      )}
    </span>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200/60">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1.5 flex items-center gap-1.5 text-[15px] font-bold leading-tight text-stone-900">
        <span className="text-[#ef5a3c]"><Icon name={icon} size={16} /></span>
        {value}
      </p>
    </div>
  );
}

function Row({ icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50 focus:outline-none focus-visible:bg-stone-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ef5a3c]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff1ed] text-[#d4401f]">
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-stone-900">{label}</span>
        {hint && <span className="block text-xs text-stone-500">{hint}</span>}
      </span>
      <span className="text-stone-400"><Icon name="chevronRight" size={18} /></span>
    </button>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = telegramUser();
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Guest';

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/mini-app/profile', { signal });
      setProfile(res.data?.data ?? res.data ?? null);
    } catch (err) {
      if (signal?.aborted || err.code === 'ERR_CANCELED') return;
      setError(getApiErrorMessage(err, 'Could not load your order summary.'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const openBot = () => {
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(BOT_LINK);
    else window.open(BOT_LINK, '_blank', 'noopener,noreferrer');
  };

  const recent = Array.isArray(profile?.recent_orders) ? profile.recent_orders : [];

  return (
    <div className="min-h-screen bg-[#f6f4f1] pb-28 text-stone-800">
      <SkeletonStyles />

      <header className="bg-gradient-to-b from-[#fcd9cb] via-[#fdeae2] to-[#f6f4f1] px-4 pb-8 pt-6">
        <h1 className="text-center text-lg font-bold text-stone-900">Profile</h1>
        <div className="mt-6">
          <Avatar user={user} name={name} />
          <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-stone-900">{name}</h2>
          {user?.username && <p className="mt-0.5 text-center text-sm text-stone-500">@{user.username}</p>}
        </div>
      </header>

      <main className="mx-auto -mt-2 max-w-3xl space-y-5 px-4">
        {/* Stats */}
        <section aria-label="Your order summary" className="rounded-3xl bg-white/60 p-2 ring-1 ring-white">
          {loading && !profile ? (
            <div role="status" aria-busy="true" className="grid grid-cols-3 gap-2">
              <span className="sr-only">Loading your summary…</span>
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[74px] !rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Total ordered" value={formatRiel(profile?.total_ordered ?? 0)} icon="coins" />
              <Stat label="Orders" value={profile?.orders_count ?? 0} icon="receipt" />
              <Stat label="This month" value={formatRiel(profile?.month_total ?? 0)} icon="chart" />
            </div>
          )}
          {profile?.favourite_item && (
            <p className="px-2 pb-1 pt-3 text-center text-xs text-stone-500">
              Your favourite: <span className="font-semibold text-stone-800">{profile.favourite_item}</span>
            </p>
          )}
        </section>

        {error && (
          <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => load()}
              className="min-h-11 self-start rounded-xl border border-amber-300 bg-white px-4 font-semibold hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c]"
            >
              Try again
            </button>
          </div>
        )}

        {/* General */}
        <section aria-label="General">
          <h2 className="mb-2 px-1 text-sm font-semibold text-stone-500">General</h2>
          <div className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200/60">
            <Row icon="receipt" label="My order" hint="Track your current order" onClick={() => navigate('/my-order')} />
            <Row icon="chart" label="Money track" hint="See what you ordered and when" onClick={() => navigate('/spending')} />
            <Row icon="bell" label="Private notifications" hint="Get order updates from the cafe bot" onClick={openBot} />
          </div>
        </section>

        {/* Recent orders */}
        <section aria-label="Recent orders">
          <h2 className="mb-2 px-1 text-sm font-semibold text-stone-500">Recent orders</h2>
          {recent.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-stone-200/60">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                <Icon name="cup" size={24} />
              </span>
              <p className="mt-3 text-sm font-semibold text-stone-900">No orders yet</p>
              <p className="mt-1 text-sm text-stone-500">Your orders will show up here.</p>
              <button
                type="button"
                onClick={() => navigate('/menu')}
                className="mt-4 min-h-11 rounded-xl bg-[#ef5a3c] px-5 text-sm font-bold text-white hover:bg-[#dc4a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c] focus-visible:ring-offset-2"
              >
                Browse menu
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200/60">
              {recent.map((order) => {
                const st = statusOf(order.status);
                return (
                  <li key={order.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900">
                        {order.order_number || `#${order.id}`}
                        {order.created_at && (
                          <span className="font-normal text-stone-500"> · {new Date(order.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                        )}
                      </p>
                      {order.items_summary && <p className="truncate text-xs text-stone-500">{order.items_summary}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-stone-900">{formatRiel(order.total_amount ?? 0)}</p>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${st.cls}`}>{st.label}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <BottomTabs />
    </div>
  );
}