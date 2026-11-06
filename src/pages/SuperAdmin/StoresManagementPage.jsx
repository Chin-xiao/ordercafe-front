// src/pages/SuperAdmin/StoresManagementPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import {
  Icon,
  Button,
  Badge,
  Card,
  StatCard,
  EmptyState,
  PageHeader,
  input as inputClass,
  table,
  tableWrap,
  th,
  td,
  tr,
} from '../../components/ui';

export default function StoresManagementPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedSlug, setCopiedSlug] = useState(null);

  // Form state for creating a new store
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    owner_name: '',
    owner_email: '',
    owner_password: '',
    auto_seed_categories: true, // Default to true
  });

  const fetchStores = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/super-admin/stores');
      const storeList = response.data?.data ?? response.data;
      setStores(Array.isArray(storeList) ? storeList : []);
    } catch (err) {
      console.error('Failed to load stores', err);
      setError(getApiErrorMessage(err, 'Failed to fetch stores data.'));
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
    setSubmitting(true);

    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim() || undefined,
        owner_name: formData.owner_name.trim(),
        owner_email: formData.owner_email.trim(),
        owner_password: formData.owner_password,
        auto_seed_categories: formData.auto_seed_categories,
      };

      const res = await api.post('/super-admin/stores', payload);
      setSuccessMsg(res.data?.message || 'New store system created successfully!');
      setShowModal(false);
      setFormData({
        name: '',
        slug: '',
        owner_name: '',
        owner_email: '',
        owner_password: '',
        auto_seed_categories: true,
      });
      fetchStores();
    } catch (err) {
      console.error('Failed to create store', err);
      setError(getApiErrorMessage(err, 'Failed to create the store.'));
    } finally {
      setSubmitting(false);
    }
  };

  const copySlug = (slug) => {
    navigator.clipboard?.writeText(slug);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  // Filtered stores
  const filteredStores = useMemo(() => {
    return stores.filter((s) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        s.name?.toLowerCase().includes(q) ||
        s.slug?.toLowerCase().includes(q) ||
        s.users?.some(
          (u) =>
            u.name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q)
        );

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && s.is_active) ||
        (statusFilter === 'suspended' && !s.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [stores, search, statusFilter]);

  // Aggregate stats
  const totalStores = stores.length;
  const activeStores = stores.filter((s) => s.is_active).length;
  const totalProducts = stores.reduce((acc, s) => acc + (s.products_count || 0), 0);
  const totalOrders = stores.reduce((acc, s) => acc + (s.orders_count || 0), 0);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Stores Management"
        description="Provision and manage isolated cafe systems, store owners, and tenant configurations."
      >
        <Button
          variant="secondary"
          icon="refresh"
          onClick={fetchStores}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
        <Button
          variant="primary"
          icon="plus"
          onClick={() => setShowModal(true)}
        >
          Create New Store
        </Button>
      </PageHeader>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Stores"
          value={totalStores}
          icon="store"
          tone="blue"
          hint="All registered tenants"
        />
        <StatCard
          label="Active Stores"
          value={activeStores}
          icon="check"
          tone="green"
          hint="Operational systems"
        />
        <StatCard
          label="Total Products"
          value={totalProducts}
          icon="cup"
          tone="amber"
          hint="Across all stores"
        />
        <StatCard
          label="Total Orders"
          value={totalOrders}
          icon="receipt"
          tone="rose"
          hint="System-wide orders"
        />
      </div>

      {/* Notifications */}
      {successMsg && (
        <div role="status" className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between text-sm shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs">✓</span>
            <span className="font-medium">{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white text-xs">!</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-rose-700 hover:text-rose-900 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stores Section Card */}
      <Card padded={false} className="overflow-hidden">
        {/* Search and Filters Bar */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/50">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
              <Icon name="search" size={16} />
            </span>
            <input
              type="text"
              placeholder="Search by store name, slug, or owner..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9 w-full bg-white`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-stone-500 whitespace-nowrap">Filter Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${inputClass} bg-white text-xs font-medium`}
            >
              <option value="all">All Stores ({stores.length})</option>
              <option value="active">Active Only ({activeStores})</option>
              <option value="suspended">Suspended Only ({stores.length - activeStores})</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className={tableWrap}>
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>ID</th>
                <th className={th}>Store Information</th>
                <th className={th}>Owner Account</th>
                <th className={`${th} text-center`}>Categories</th>
                <th className={`${th} text-center`}>Products</th>
                <th className={`${th} text-center`}>Sessions</th>
                <th className={`${th} text-center`}>Orders</th>
                <th className={th}>Status</th>
                <th className={th}>Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredStores.map((store) => {
                const owner = store.users?.[0];
                return (
                  <tr key={store.id} className={tr}>
                    <td className={`${td} font-mono text-xs text-stone-400 font-semibold`}>
                      #{store.id}
                    </td>

                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#ef5a3c] font-bold text-sm">
                          {store.name?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                        <div>
                          <div className="font-semibold text-stone-900">{store.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-xs text-stone-400">/{store.slug}</span>
                            <button
                              type="button"
                              onClick={() => copySlug(store.slug)}
                              title="Copy store slug"
                              className="text-stone-400 hover:text-stone-600 transition-colors"
                            >
                              {copiedSlug === store.slug ? (
                                <span className="text-[10px] text-emerald-600 font-semibold">Copied!</span>
                              ) : (
                                <Icon name="receipt" size={12} />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className={td}>
                      {owner ? (
                        <div>
                          <div className="font-medium text-stone-800 text-xs flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                            {owner.name}
                          </div>
                          <div className="text-stone-400 text-xs font-mono mt-0.5">{owner.email}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-400 italic">No owner account</span>
                      )}
                    </td>

                    <td className={`${td} text-center`}>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-stone-700">
                        {store.categories_count ?? 0}
                      </span>
                    </td>

                    <td className={`${td} text-center`}>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-stone-700">
                        {store.products_count ?? 0}
                      </span>
                    </td>

                    <td className={`${td} text-center`}>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-stone-700">
                        {store.order_sessions_count ?? 0}
                      </span>
                    </td>

                    <td className={`${td} text-center`}>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-stone-700">
                        {store.orders_count ?? 0}
                      </span>
                    </td>

                    <td className={td}>
                      <Badge tone={store.is_active ? 'green' : 'red'}>
                        {store.is_active ? 'Active' : 'Suspended'}
                      </Badge>
                    </td>

                    <td className={`${td} text-xs text-stone-400`}>
                      {store.created_at ? new Date(store.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}

              {filteredStores.length === 0 && !loading && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      icon="store"
                      title={search ? 'No matching stores found' : 'No store systems created yet'}
                      description={
                        search
                          ? `No stores match the search query "${search}". Try searching with a different term.`
                          : 'Get started by provisioning the first multi-tenant store for your application.'
                      }
                      action={
                        !search && (
                          <Button variant="primary" icon="plus" onClick={() => setShowModal(true)}>
                            Create First Store
                          </Button>
                        )
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Store Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl my-8 border border-stone-100 animate-scaleUp">
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-5">
              <div>
                <h2 className="text-xl font-bold text-stone-900">Create New Store System</h2>
                <p className="text-xs text-stone-500 mt-1">
                  Provisions a new isolated database tenant with an assigned store owner account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-4">
              {/* Section 1: Store Information */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[#ef5a3c] text-xs font-bold">1</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Store Information</h3>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Store Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Riverside Cafe & Bakery"
                    className={`${inputClass} w-full`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Custom Slug <span className="text-stone-400 font-normal">(optional, auto-generated if empty)</span>
                  </label>
                  <div className="flex items-center rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus-within:border-stone-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-200">
                    <span className="text-stone-400 text-xs font-mono select-none">https://cafe/</span>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="riverside-cafe"
                      className="w-full bg-transparent border-0 p-0 text-sm outline-none font-mono text-stone-800 ml-1"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Store Owner Credentials */}
              <div className="space-y-3 pt-3 border-t border-stone-100">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[#ef5a3c] text-xs font-bold">2</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Store Owner Account</h3>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Owner Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    placeholder="e.g. Socheat Manager"
                    className={`${inputClass} w-full`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Owner Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.owner_email}
                    onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                    placeholder="manager@riverside.com"
                    className={`${inputClass} w-full`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Owner Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.owner_password}
                    onChange={(e) => setFormData({ ...formData, owner_password: e.target.value })}
                    placeholder="Minimum 6 characters"
                    className={`${inputClass} w-full`}
                  />
                </div>
              </div>

              {/* Section 3: Provisioning Options & Auto-seed Categories */}
              <div className="pt-3 border-t border-stone-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[#ef5a3c] text-xs font-bold">3</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Catalog Initialization</h3>
                </div>

                {/* Auto-seed default categories toggle */}
                <div
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      auto_seed_categories: !prev.auto_seed_categories,
                    }))
                  }
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    formData.auto_seed_categories
                      ? 'border-emerald-200 bg-emerald-50/60 ring-1 ring-emerald-500/20'
                      : 'border-stone-200 bg-stone-50/70'
                  }`}
                >
                  <div className="space-y-0.5 pr-2">
                    <span className="block text-xs font-bold text-stone-900">
                      Auto-create default categories (Drink & Snacks)
                    </span>
                    <span className="block text-[11px] text-stone-500 leading-relaxed">
                      Automatically seeds isolated "Drink" and "Snacks" categories so the store owner can immediately create products without empty dropdown errors.
                    </span>
                  </div>

                  {/* Accessible Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.auto_seed_categories}
                    aria-label="Auto-create default categories (Drink & Snacks)"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData((prev) => ({
                        ...prev,
                        auto_seed_categories: !prev.auto_seed_categories,
                      }));
                    }}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      formData.auto_seed_categories ? 'bg-emerald-600' : 'bg-stone-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                        formData.auto_seed_categories ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2.5 pt-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 bg-[#ef5a3c] text-white hover:bg-[#dc4a2c] disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
                >
                  {submitting ? 'Creating System...' : 'Create Store System'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
