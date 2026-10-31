// src/components/ui.jsx  — shared UI kit for every admin page
import React from 'react';

/* ---------- Icons ---------- */
const ICONS = {
  dashboard: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  cup: 'M17 8h1a4 4 0 0 1 0 8h-1 M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z M6 1v3 M10 1v3 M14 1v3',
  chart: 'M3 3v18h18 M7 15v3 M12 10v8 M17 6v12',
  bot: 'M5 8h14v10H5z M12 8V4 M9 13h.01 M15 13h.01',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  store: 'M3 9l2-5h14l2 5 M4 9v11h16V9 M9 20v-6h6v6',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  close: 'M18 6L6 18 M6 6l12 12',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  chevronLeft: 'M15 18l-6-6 6-6',
  plus: 'M12 5v14 M5 12h14',
  trendUp: 'M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6',
  receipt: 'M4 2v20l3-2 3 2 3-2 3 2 3-2V2z M8 8h8 M8 12h8',
  coins: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v12 M15 9h-4.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H9',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35',
  chevronDown: 'M6 9l6 6 6-6',
  trash: 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6',
  image: 'M3 3h18v18H3z M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M21 15l-5-5L5 21',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54z',
  check: 'M20 6L9 17l-5-5',
  sidebar: 'M3 3h18v18H3z M9 3v18',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
};

export function Icon({ name, className = '', size = 18 }) {
  // width/height attributes guarantee a sensible size even if Tailwind
  // does not scan this file; any h-*/w-* class passed in still overrides them.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({ title, description, children }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        {description && <p className="mt-1 max-w-xl text-sm text-stone-500">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/* ---------- Card ---------- */
export function Card({ title, action, children, className = '', padded = true }) {
  return (
    <section className={`rounded-2xl border border-stone-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
          {action}
        </div>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

/* ---------- Stat card ---------- */
const TONES = {
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-sky-50 text-sky-700',
  rose: 'bg-rose-50 text-rose-700',
};

export function StatCard({ label, value, hint, icon = 'chart', tone = 'green' }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm text-stone-500">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONES[tone]}`}>
          <Icon name={icon} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

/* ---------- Button ---------- */
const BTN = {
  primary: 'bg-[#ef5a3c] text-white hover:bg-[#dc4a2c] focus-visible:ring-orange-300',
  accent: 'bg-amber-400 text-[#ef5a3c] hover:bg-amber-300 focus-visible:ring-amber-500',
  secondary: 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 focus-visible:ring-stone-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-400',
  ghost: 'text-stone-600 hover:bg-stone-100 focus-visible:ring-stone-400',
};

export function Button({ variant = 'primary', icon, children, className = '', ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${BTN[variant]} ${className}`}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

/* ---------- Badge ---------- */
const BADGE = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  gray: 'bg-stone-100 text-stone-600 ring-stone-500/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
};

export function Badge({ tone = 'gray', children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE[tone]}`}>
      {children}
    </span>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon = 'inbox', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
        <Icon name={icon} size={24} />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-stone-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- Table + form class helpers (use on your own <table>/<input>) ---------- */
export const tableWrap = 'overflow-x-auto';
export const table = 'w-full text-left text-sm';
export const th = 'whitespace-nowrap bg-stone-50 px-5 py-3 text-xs font-semibold text-stone-500';
export const td = 'whitespace-nowrap border-t border-stone-100 px-5 py-3.5 text-stone-700';
export const tr = 'transition-colors hover:bg-stone-50/70';
export const input =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#ef5a3c] focus:outline-none focus:ring-2 focus:ring-[#ef5a3c]/20';

/* ---------- Skeleton loading blocks ---------- */
// Render <SkeletonStyles /> once inside any page that uses <Skeleton />.
export function SkeletonStyles() {
  return (
    <style>{`
@keyframes sk-shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
@keyframes sk-bar{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}
.sk{background:linear-gradient(90deg,#e7e5e4 25%,#f5f5f4 50%,#e7e5e4 75%);background-size:1200px 100%;animation:sk-shimmer 1.5s linear infinite}
.sk-bar{animation:sk-bar 1.3s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.sk,.sk-bar{animation:none}}
`}</style>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`sk rounded-md ${className}`} />;
}

/* Thin sliding bar for the top edge of a loading area */
export function LoadingBar() {
  return (
    <div aria-hidden="true" className="h-[3px] w-full overflow-hidden bg-[#ef5a3c]/15">
      <div className="sk-bar h-full w-2/5 rounded-full bg-[#ef5a3c]" />
    </div>
  );
}