// src/layouts/AdminLayout.jsx — slim icon sidebar + search/user top bar (POS-style)
import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/ui';

function readUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}') || {}; } catch { return {}; }
}
function initials(name = '') {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return p.length ? (p[0][0] + (p[1]?.[0] || '')).toUpperCase() : 'A';
}

function readExpanded() {
  try { return localStorage.getItem('admin_sidebar_open') === '1'; } catch { return false; }
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expanded, setExpanded] = useState(readExpanded);

  const hasToken = Boolean(localStorage.getItem('admin_token') || localStorage.getItem('token'));
  const user = readUser();
  const isSuperAdmin = user.role === 'superadmin';
  const displayName = user.name || user.username || user.email || 'Admin';
  const roleLabel = isSuperAdmin ? 'Super admin' : 'Controller';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const items = useMemo(() => [
    { to: '/admin/dashboard', label: 'Dashboard', short: 'Home', icon: 'dashboard' },
    { to: '/admin/sessions', label: 'Order sessions', short: 'Orders', icon: 'clock' },
    { to: '/admin/products', label: 'Products & categories', short: 'Products', icon: 'cup' },
    { to: '/admin/reports', label: 'Sales reports', short: 'Reports', icon: 'chart' },
    { to: '/admin/telegram-settings', label: 'Telegram bot', short: 'Bot', icon: 'bot' },
    { to: '/admin/telegram-customers', label: 'Telegram customers', short: 'Customers', icon: 'message' },
    ...(isSuperAdmin ? [
      { to: '/admin/stores', label: 'Stores', short: 'Stores', icon: 'store' },
      { to: '/admin/users', label: 'Staff & users', short: 'Staff', icon: 'users' },
    ] : []),
  ], [isSuperAdmin]);

  useEffect(() => { setSheetOpen(false); }, [location.pathname]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setSheetOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleSidebar = () => {
    setExpanded((open) => {
      try { localStorage.setItem('admin_sidebar_open', open ? '0' : '1'); } catch { /* ignore */ }
      return !open;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const onSearch = (e) => {
    const next = new URLSearchParams(params);
    if (e.target.value) next.set('q', e.target.value); else next.delete('q');
    setParams(next, { replace: true });
  };

  if (!hasToken) return <Navigate to="/admin/login" replace />;

  return (
    <div className="flex min-h-screen gap-3 bg-[#f1f1f3] p-0 font-sans text-stone-800 md:h-screen md:p-3">
      {/* Sidebar: icons only, or icons with names */}
      <aside className={`hidden shrink-0 flex-col rounded-2xl bg-white py-4 shadow-sm transition-[width] duration-200 md:flex ${expanded ? 'w-60 px-3' : 'w-[76px] items-center'}`}>
        <div className={expanded ? 'flex items-center gap-3 px-1' : 'flex flex-col items-center gap-3'}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ef5a3c] text-white">
            <Icon name="cup" size={22} />
          </span>
          {expanded && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-bold text-stone-900">Cafe Admin</p>
              <p className="text-xs text-stone-500">Back office</p>
            </div>
          )}
          <button type="button" onClick={toggleSidebar} aria-expanded={expanded}
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'} title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">
            <Icon name="sidebar" size={18} />
          </button>
        </div>

        <nav aria-label="Admin navigation" className={`mt-6 flex flex-1 flex-col gap-2 overflow-y-auto ${expanded ? '' : 'items-center overflow-visible'}`}>
          {items.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} aria-label={label}
              className={({ isActive }) =>
                `group relative flex h-11 items-center rounded-xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${
                  expanded ? 'w-full gap-3 px-3' : 'w-11 justify-center'
                } ${isActive ? 'border-[#ef5a3c]/30 bg-[#fff1ed] text-[#ef5a3c]' : 'border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-800'}`}>
              <Icon name={icon} size={20} />
              {expanded ? (
                <span className="truncate text-sm font-medium">{label}</span>
              ) : (
                <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <button type="button" onClick={handleLogout} aria-label="Log out"
          className={`group relative flex h-11 items-center rounded-xl text-stone-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${expanded ? 'w-full gap-3 px-3' : 'w-11 justify-center'}`}>
          <Icon name="logout" size={20} />
          {expanded ? (
            <span className="text-sm font-medium">Log out</span>
          ) : (
            <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              Log out
            </span>
          )}
        </button>
      </aside>

      {/* Main card */}
      <div className="flex min-w-0 flex-1 flex-col bg-white shadow-sm md:rounded-2xl">
        <header className="flex shrink-0 items-center gap-4 border-b border-stone-100 px-4 py-3 md:px-6">
          <div className="relative max-w-md flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"><Icon name="search" size={16} /></span>
            <input type="search" value={params.get('q') || ''} onChange={onSearch} placeholder="Search products…" aria-label="Search"
              className="w-full rounded-full border border-stone-200 bg-stone-50 py-2.5 pl-10 pr-4 text-sm placeholder:text-stone-400 focus:border-[#ef5a3c] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ef5a3c]/20" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-semibold text-stone-900">{displayName}</p>
              <p className="text-xs text-stone-500">{roleLabel} · {today}</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff1ed] text-sm font-bold text-[#ef5a3c]">{initials(displayName)}</span>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {items.slice(0, 4).map(({ to, short, icon }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-[#ef5a3c]' : 'text-stone-500'}`}>
            <Icon name={icon} size={20} />{short}
          </NavLink>
        ))}
        <button type="button" onClick={() => setSheetOpen(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-stone-500">
          <Icon name="menu" size={20} />More
        </button>
      </nav>

      {/* Mobile "More" sheet */}
      <div className={`fixed inset-0 z-40 md:hidden ${sheetOpen ? '' : 'pointer-events-none'}`}>
        <div onClick={() => setSheetOpen(false)} className={`absolute inset-0 bg-black/40 transition-opacity ${sheetOpen ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 pb-8 shadow-xl transition-transform duration-200 ${sheetOpen ? 'translate-y-0' : 'translate-y-full'}`}>
          <ul className="grid grid-cols-3 gap-2">
            {items.slice(4).map(({ to, short, icon }) => (
              <li key={to}>
                <NavLink to={to} className="flex flex-col items-center gap-1 rounded-xl bg-stone-50 py-3 text-xs font-medium text-stone-700">
                  <Icon name={icon} size={22} />{short}
                </NavLink>
              </li>
            ))}
            <li>
              <button type="button" onClick={handleLogout} className="flex w-full flex-col items-center gap-1 rounded-xl bg-rose-50 py-3 text-xs font-medium text-rose-600">
                <Icon name="logout" size={22} />Log out
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}