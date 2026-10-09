// src/layouts/AdminLayout.jsx
import React from 'react';
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';

export default function AdminLayout() {
  const navigate = useNavigate();
  const hasToken = Boolean(localStorage.getItem('admin_token') || localStorage.getItem('token'));

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('token');
    navigate('/');
  };

  if (!hasToken) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 font-sans md:h-screen md:flex-row">
      <aside className="flex w-full flex-col bg-slate-900 text-slate-300 md:w-64 md:shrink-0">
        <div className="border-b border-slate-800 px-5 py-4 text-lg font-bold text-white md:p-6 md:text-xl">
          ☕ Cafe Admin
        </div>
        <nav aria-label="Admin navigation" className="flex gap-1 overflow-x-auto p-2 md:flex-1 md:flex-col md:gap-1 md:overflow-visible md:p-4">
          {[
            ['/admin/dashboard', '📊 Dashboard'],
            ['/admin/sessions', '🕒 Order Sessions'],
            ['/admin/products', '🍔 Products & Categories'],
            ['/admin/reports', '📈 Sales Reports'],
            ['/admin/telegram-settings', '🤖 Telegram Bot'],
          ].map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition md:px-4 ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-slate-800 p-4 md:block">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 rounded text-red-400 hover:bg-red-500 hover:text-white transition"
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-white px-4 shadow-sm md:h-16 md:px-8">
          <h2 className="text-base font-semibold text-gray-800 md:text-lg">Control Panel</h2>
          <div className="flex items-center gap-2">
          <span className="hidden text-sm bg-stone-100 text-stone-700 px-3 py-1 rounded-full font-medium sm:inline-flex">
            Administrator
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 md:hidden"
          >
            Logout
          </button>
          </div>
        </header>
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}