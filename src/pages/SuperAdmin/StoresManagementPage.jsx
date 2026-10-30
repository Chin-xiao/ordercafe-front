import React, { useState, useEffect } from 'react';
import api from '../../api/axios'; // Adjust path to your axios instance

export default function StoresManagementPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form state for creating a new store
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    owner_name: '',
    owner_email: '',
    owner_password: '',
  });

  const fetchStores = async () => {
    try {
      setLoading(true);
      const response = await api.get('/super-admin/stores');
      setStores(response.data.data || []);
    } catch (err) {
      console.error('Failed to load stores', err);
      setError('Failed to fetch stores data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const handleCreateStore = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    try {
      await api.post('/super-admin/stores', formData);
      setSuccessMsg('New store system created successfully!');
      setShowModal(false);
      setFormData({ name: '', slug: '', owner_name: '', owner_email: '', owner_password: '' });
      fetchStores();
    } catch (err) {
      console.error('Failed to create store', err);
      setError(err.response?.data?.message || 'Failed to create the store.');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stores Management</h1>
          <p className="text-sm text-gray-500">Control all individual cafe systems, isolated reports, and tenant accounts.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl shadow-sm transition"
        >
          + Create New Store System
        </button>
      </div>

      {successMsg && <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 rounded-lg text-sm">{successMsg}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Stores Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="p-4">Store Name</th>
              <th className="p-4">Slug / Identifier</th>
              <th className="p-4">Products</th>
              <th className="p-4">Order Sessions</th>
              <th className="p-4">Total Orders</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {stores.map((store) => (
              <tr key={store.id} className="hover:bg-gray-50/50">
                <td className="p-4 font-bold text-gray-900">{store.name}</td>
                <td className="p-4 font-mono text-xs text-gray-500">{store.slug}</td>
                <td className="p-4">{store.products_count ?? 0} items</td>
                <td className="p-4">{store.order_sessions_count ?? 0} sessions</td>
                <td className="p-4">{store.orders_count ?? 0} orders</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${store.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {store.is_active ? 'Active' : 'Suspended'}
                  </span>
                </td>
              </tr>
            ))}
            {stores.length === 0 && !loading && (
              <tr>
                <td colSpan="6" className="p-8 text-center text-gray-400">No store systems created yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Store Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Create New Store System</h2>
            <p className="text-xs text-gray-500 mb-4">This will provision an isolated system with an empty product catalog and its own owner login.</p>

            <form onSubmit={handleCreateStore} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Store Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Riverside Cafe"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Custom Slug (Optional)</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g. riverside-cafe (auto-generated if empty)"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>
              <hr className="border-gray-100 my-2" />
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Store Owner Name</label>
                <input
                  type="text"
                  required
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  placeholder="e.g. John Manager"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Owner Email</label>
                <input
                  type="email"
                  required
                  value={formData.owner_email}
                  onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                  placeholder="owner@store.com"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Owner Password</label>
                <input
                  type="password"
                  required
                  value={formData.owner_password}
                  onChange={(e) => setFormData({ ...formData, owner_password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  Create System
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}