import React, { useEffect, useState } from 'react';
import api from '../../api/axios';

export default function OrderSessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // New session form state
  const [title, setTitle] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/order-sessions');
      setSessions(res.data.data || res.data);
    } catch (err) {
      console.error('Failed to load order sessions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/order-sessions', {
        title,
        expires_at: expiresAt,
      });
      setTitle('');
      setExpiresAt('');
      setShowModal(false);
      fetchSessions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create session.');
    }
  };

  const handleStartSession = async (id) => {
    try {
      await api.post(`/admin/order-sessions/${id}/start`);
      alert('Order session started! Telegram bot has announced it to the group.');
      fetchSessions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start session.');
    }
  };

  const handleCloseSession = async (id) => {
    if (!window.confirm('Close this session? This will lock customer orders and dispatch the summary to Telegram.')) return;
    try {
      await api.post(`/admin/order-sessions/${id}/close`);
      alert('Session closed and Telegram summary dispatched successfully!');
      fetchSessions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to close session.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case 'OPEN':
        return <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full animate-pulse">🟢 OPEN</span>;
      case 'CLOSED':
        return <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">🔴 CLOSED</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">⏳ DRAFT</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Order Sessions Management</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-sm shadow transition"
        >
          + Create New Session
        </button>
      </div>

      {/* Create Session Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Create Order Session</h3>
            <form onSubmit={handleCreateSession}>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Session Title (e.g., Lunch Order)</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Lunch Order #1024"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Expiration Time</label>
                <input
                  type="datetime-local"
                  required
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 text-sm font-semibold hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow"
                >
                  Save Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sessions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-500 text-center">Loading sessions...</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold bg-gray-50">
                <th className="p-4">Session Title</th>
                <th className="p-4">Order Number</th>
                <th className="p-4">Status</th>
                <th className="p-4">Expires At</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-semibold text-gray-800">{session.title}</td>
                  <td className="p-4 font-mono text-gray-600">{session.order_number}</td>
                  <td className="p-4">{getStatusBadge(session.status)}</td>
                  <td className="p-4 text-gray-600">{new Date(session.expires_at).toLocaleString()}</td>
                  <td className="p-4 text-right space-x-2">
                    {session.status === 'DRAFT' && (
                      <button
                        onClick={() => handleStartSession(session.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg text-xs shadow transition"
                      >
                        🚀 Start Order
                      </button>
                    )}
                    {session.status === 'OPEN' && (
                      <button
                        onClick={() => handleCloseSession(session.id)}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium px-3 py-1.5 rounded-lg text-xs shadow transition"
                      >
                        🛑 Close Order
                      </button>
                    )}
                    {session.status === 'CLOSED' && (
                      <span className="text-xs text-gray-400 font-medium italic">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">No order sessions created yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}