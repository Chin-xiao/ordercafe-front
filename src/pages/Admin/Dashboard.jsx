// src/pages/Admin/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import api from '../../api/axios'; // Axios client with Sanctum auth interceptors

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/admin/dashboard');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleCloseSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to close this session? This will lock ordering and notify Telegram.')) return;

    try {
      await api.post(`/admin/order-sessions/${sessionId}/close`);
      alert('Order session closed and Telegram summary dispatched successfully!');
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to close session.');
    }
  };

  if (loading) return <div className="p-4 text-gray-500">Loading metrics...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Overview Dashboard</h1>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Today's Orders</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.today_orders || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Today's Customers</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.today_customers || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Today's Revenue</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">${Number(stats?.today_revenue || 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Active Order Session Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>🟢 Active Order Session</span>
        </h3>

        {stats?.active_session ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h4 className="text-xl font-bold text-slate-800">{stats.active_session.title}</h4>
              <p className="text-sm text-gray-500 mt-1">Session Number: <span className="font-mono font-medium text-slate-700">{stats.active_session.order_number}</span></p>
              <p className="text-sm text-gray-500 mt-0.5">Started At: {new Date(stats.active_session.started_at).toLocaleTimeString()}</p>
            </div>
            <button
              onClick={() => handleCloseSession(stats.active_session.id)}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow transition"
            >
              Close Session & Notify Telegram
            </button>
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <p className="text-gray-500">No active session running right now.</p>
            <a href="/admin/sessions" className="text-emerald-600 font-semibold text-sm mt-2 inline-block hover:underline">
              + Go to Order Sessions to start a new one
            </a>
          </div>
        )}
      </div>
    </div>
  );
}