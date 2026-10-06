// src/layouts/AdminLayout.jsx
import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col">
        <div className="p-6 text-xl font-bold text-white border-b border-slate-800">
          ☕ Cafe Admin
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Link to="/admin/dashboard" className="block px-4 py-2.5 rounded hover:bg-slate-800 hover:text-white transition">
            📊 Dashboard
          </Link>
          <Link to="/admin/sessions" className="block px-4 py-2.5 rounded hover:bg-slate-800 hover:text-white transition">
            🕒 Order Sessions
          </Link>
          <Link to="/admin/products" className="block px-4 py-2.5 rounded hover:bg-slate-800 hover:text-white transition">
            🍔 Products & Categories
          </Link>
          <Link to="/admin/reports" className="block px-4 py-2.5 rounded hover:bg-slate-800 hover:text-white transition">
            📈 Sales Reports
          </Link>
          <Link 
  to="/admin/telegram-settings" 
  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition"
>
  <span>🤖 Telegram Bot</span>
</Link>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 rounded text-red-400 hover:bg-red-500 hover:text-white transition"
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white shadow-sm h-16 flex items-center px-8 justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Control Panel</h2>
          <span className="text-sm bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-medium">
            🟢 System Online
          </span>
        </header>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}