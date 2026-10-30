import React, { useState, useEffect } from 'react';
import { formatDateTime, formatRemainingTime, getSessionStatus, isOrderSessionOpen } from '../../utils/orderSession';

const INITIAL_NOW = Date.now();

export default function SessionBanner({ session, sessionVerified, sessionError, onRefresh }) {
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

  return (
    <>
      <header className="sticky top-0 z-25 flex items-center justify-between gap-3 border-b border-emerald-800/10 bg-emerald-700 px-4 py-3 text-white shadow-sm">
        <div>
          <h1 className="text-base font-bold leading-tight">{session?.title || 'Cafe Menu'}</h1>
          <p className="mt-0.5 text-xs text-emerald-100">Fresh from the cafe</p>
        </div>
        <div className="max-w-[45%] rounded-full bg-emerald-800 px-3 py-1.5 text-right text-[11px] font-semibold leading-tight">
          {orderingOpen
            ? `Open · Closes ${new Date(session.expires_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
            : sessionVerified
              ? (session ? (status.toLowerCase() === 'expired' ? 'Expired' : 'Ordering closed') : 'No Session')
              : 'Connecting...'}
        </div>
      </header>

      <section
        role={nearExpiration ? 'alert' : undefined}
        className={`mx-4 mt-4 rounded-xl border p-3 text-sm ${
          orderingOpen
            ? nearExpiration
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : !sessionVerified
              ? 'border-sky-200 bg-sky-50 text-sky-900'
              : 'border-red-200 bg-red-50 text-red-800'
        }`}
      >
        {orderingOpen ? (
          <>
            <p className="font-bold">{session.title}</p>
            <p>Ordering closes at {new Date(session.expires_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {formatDateTime(session.expires_at)}</p>
            <p className="font-semibold">
              {nearExpiration ? 'Hurry, ordering closes soon: ' : 'Time remaining: '}
              {formatRemainingTime(session.expires_at, now)}
            </p>
          </>
        ) : !sessionVerified && !session ? (
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-700"></div>
            <div>
              <p className="font-bold">Loading session...</p>
              <p className="text-xs mt-0.5">Checking kitchen status instantly.</p>
            </div>
          </div>
        ) : (
          <>
            <p className="font-bold">Ordering is closed</p>
            <p>
              {session?.expires_at
                ? `This ordering session is ${status.toLowerCase()}. It closed at ${formatDateTime(session.expires_at)}.`
                : 'There is no currently open order session.'}
            </p>
            {sessionError && <p className="mt-1">{sessionError}</p>}
            <button type="button" onClick={onRefresh} className="mt-2 min-h-11 font-semibold underline">
              Refresh session status
            </button>
          </>
        )}
      </section>
    </>
  );
}