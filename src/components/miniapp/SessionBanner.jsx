import React, { useEffect, useState } from 'react';
import { Icon } from '../ui';
import { formatDateTime, formatRemainingTime, getSessionStatus, isOrderSessionOpen } from '../../utils/orderSession';

const INITIAL_NOW = Date.now();
const timeOf = (value) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function SessionBanner({ session, sessionVerified, sessionError, onRefresh, onMyOrder }) {
  const [now, setNow] = useState(INITIAL_NOW);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const status = getSessionStatus(session, now);
  const orderingOpen = sessionVerified && isOrderSessionOpen(session, now);
  const expirationMs = session?.expires_at ? new Date(session.expires_at).getTime() : NaN;
  const secondsRemaining = Number.isFinite(expirationMs)
    ? Math.max(0, Math.floor((expirationMs - now) / 1000))
    : null;
  const nearExpiration = orderingOpen && secondsRemaining !== null && secondsRemaining <= 300;

  const refreshButton = (label) => (
    <button
      type="button"
      onClick={onRefresh}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c]"
    >
      <Icon name="refresh" size={16} />
      {label}
    </button>
  );

  let statusRow;
  if (orderingOpen) {
    statusRow = (
      <div role={nearExpiration ? 'alert' : 'status'} className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold ${nearExpiration ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-400/15 text-emerald-300'}`}>
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${nearExpiration ? 'animate-pulse bg-amber-400 motion-reduce:animate-none' : 'bg-emerald-400'}`} />
          {nearExpiration ? 'Hurry, ordering closes soon' : `Open · Closes ${timeOf(session.expires_at)}`}
        </span>
        <span className={`text-xs font-medium ${nearExpiration ? 'text-amber-300' : 'text-stone-300'}`}>
          Time left: {formatRemainingTime(session.expires_at, now)}
        </span>
      </div>
    );
  } else if (!sessionVerified) {
    statusRow = sessionError ? (
      <div role="alert" className="space-y-2">
        <p className="text-sm text-amber-300">{sessionError}</p>
        {refreshButton('Retry')}
      </div>
    ) : (
      <div role="status" className="flex items-center gap-3 text-stone-300">
        <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-[#ef5a3c] motion-reduce:animate-none" />
        <span className="text-sm">
          <span className="font-semibold text-white">Connecting…</span> Checking kitchen status.
        </span>
      </div>
    );
  } else {
    statusRow = (
      <div role="status" className="space-y-2">
        <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-semibold text-stone-200">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-red-400" />
          {session ? (status.toLowerCase() === 'expired' ? 'Expired' : 'Ordering closed') : 'No session'}
        </span>
        <p className="text-sm text-stone-300">
          {session?.expires_at
            ? `This ordering session is ${status.toLowerCase()}. It closed at ${formatDateTime(session.expires_at)}.`
            : 'There is no currently open order session.'}
        </p>
        {sessionError && <p className="text-sm text-amber-300">{sessionError}</p>}
        {refreshButton('Refresh session status')}
      </div>
    );
  }

  return (
    <section aria-label="Order session" className="bg-[#1f1a17] px-4 pb-3 pt-3 text-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-lg font-bold">{session?.title || 'Cafe Menu'}</h1>
          <p className="text-xs text-stone-400">Fresh from the cafe</p>
        </div>
        {onMyOrder && (
          <button
            type="button"
            onClick={onMyOrder}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef5a3c]"
          >
            <Icon name="receipt" size={16} />
            My order
          </button>
        )}
      </div>

      <div className="mx-auto mt-3 max-w-3xl">{statusRow}</div>
    </section>
  );
}