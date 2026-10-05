import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function OrderSessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  
  // Form state for creating a session
  const [title, setTitle] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/sessions');
      // Handles both paginated Laravel responses (.data) and raw arrays
      setSessions(response.data.data || response.data);
    } catch (err) {
      console.error('Failed to load sessions', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/sessions', {
        title,
        expires_at: expiresAt || null,
      });
      setTitle('');
      setExpiresAt('');
      setShowCreateModal(false);
      fetchSessions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create session');
    }
  };

  const handleStartSession = async (id) => {
    try {
      await api.post(`/admin/sessions/${id}/start`);
      fetchSessions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start session');
    }
  };

  const handleCloseSession = async (id) => {
    try {
      await api.post(`/admin/sessions/${id}/close`);
      fetchSessions();
      if (selectedSession && selectedSession.id === id) {
        setSelectedSession(null);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to close session');
    }
  };

  const handleViewDetails = async (id) => {
    try {
      const response = await api.get(`/admin/sessions/${id}`);
      setSelectedSession(response.data.data);
    } catch (err) {
      alert('Failed to load session details');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Order Sessions Control</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          + Create New Session
        </button>
      </div>

      {/* Sessions Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-100">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creator</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires At</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-gray-500">Loading sessions...</td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-gray-500">No order sessions found.</td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{session.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      session.status === 'open' ? 'bg-green-100 text-green-800' :
                      session.status === 'closed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {session.status || 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {session.creator?.name || 'Admin'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {session.expires_at ? new Date(session.expires_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleViewDetails(session.id)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      View
                    </button>
                    {session.status !== 'open' && session.status !== 'closed' && (
                      <button
                        onClick={() => handleStartSession(session.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Start
                      </button>
                    )}
                    {session.status === 'open' && (
                      <button
                        onClick={() => handleCloseSession(session.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Close
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Session: {selectedSession.title}</h2>
              <button onClick={() => setSelectedSession(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <p><strong>Status:</strong> {selectedSession.status}</p>
              <p><strong>Created By:</strong> {selectedSession.creator?.name}</p>
              <h3 className="font-semibold text-lg mt-4">Orders Placed ({selectedSession.orders?.length || 0})</h3>
              <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                {selectedSession.orders?.length === 0 ? (
                  <p className="text-sm text-gray-500">No orders in this session yet.</p>
                ) : (
                  selectedSession.orders?.map((order) => (
                    <div key={order.id} className="border-b pb-2 text-sm">
                      <div className="flex justify-between font-medium">
                        <span>User: {order.user?.name || 'Telegram User'}</span>
                        <span>Total: ${order.total_price}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Create Order Session</h2>
            {error && <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Session Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Morning Coffee Run"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Expires At (Optional)</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Save as Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}