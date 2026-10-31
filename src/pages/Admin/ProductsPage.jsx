// src/pages/admin/ProductsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { cachedGet, peek } from '../../api/cachedGet';
import { getApiErrorMessage } from '../../api/errors';
import { Icon, Button, Badge, EmptyState, input } from '../../components/ui';
import CoffeeLoader from '../../components/CoffeeLoader';

const unwrap = (res) => {
  const list = res?.data?.data ?? res?.data;
  return Array.isArray(list) ? list : null;
};

const EMPTY_FORM = { name: '', categoryId: '', price: '', imageUrl: '', requiresSugar: false };

function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${checked ? 'bg-[#ef5a3c]' : 'bg-stone-300'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function Thumb({ src, alt = '', className = '' }) {
  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-stone-100 text-stone-300 ${className}`}>
      <Icon name="cup" size={36} />
      {src && (
        <img src={src} alt={alt} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }}
          className="absolute inset-0 h-full w-full object-cover" />
      )}
    </div>
  );
}

export default function ProductsPage() {
  const [params] = useSearchParams();
  const q = (params.get('q') || '').trim().toLowerCase();

  // Show the last known data instantly (if any) and refresh it quietly in the background
  const cachedProducts = unwrap(peek('/admin/products'));
  const cachedCategories = unwrap(peek('/admin/categories'));
  const hasCache = Boolean(cachedProducts && cachedCategories);

  const [products, setProducts] = useState(cachedProducts || []);
  const [categories, setCategories] = useState(cachedCategories || []);
  const [loading, setLoading] = useState(!hasCache);
  const [loadError, setLoadError] = useState('');

  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('all');

  // Panel / form state
  const [showPanel, setShowPanel] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const fetchData = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const [prodRes, catRes] = await Promise.all([cachedGet('/admin/products'), cachedGet('/admin/categories')]);
      const productList = prodRes.data?.data ?? prodRes.data;
      const categoryList = catRes.data?.data ?? catRes.data;
      if (!Array.isArray(productList) || !Array.isArray(categoryList)) {
        throw new Error('The API returned an invalid products or categories response.');
      }
      setProducts(productList);
      setCategories(categoryList);
      setLoadError('');
    } catch (err) {
      console.error('Failed to fetch products or categories', err);
      setProducts([]);
      setCategories([]);
      setLoadError(getApiErrorMessage(err, 'Failed to load products and categories.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData({ silent: hasCache }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showPanel) return undefined;
    const onKey = (e) => e.key === 'Escape' && setShowPanel(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPanel]);

  const productCategoryId = (p) => String(p.category_id ?? p.category?.id ?? '');

  const openCreate = () => {
    setEditingProduct(null);
    setForm({ ...EMPTY_FORM, categoryId: cat === 'all' ? '' : cat });
    setError('');
    setShowPanel(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name || '',
      categoryId: productCategoryId(product),
      price: product.price || '',
      imageUrl: product.image_url || '',
      requiresSugar: product.requires_sugar ?? false,
    });
    setError('');
    setShowPanel(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        category_id: form.categoryId,
        price: form.price,
        image_url: form.imageUrl,
        requires_sugar: form.requiresSugar,
      };
      if (editingProduct) await api.put(`/admin/products/${editingProduct.id}`, payload);
      else await api.post('/admin/products', payload);
      setShowPanel(false);
      fetchData({ silent: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save product.'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAvailability = async (id) => {
    try {
      await api.patch(`/admin/products/${id}/availability`);
      setEditingProduct((p) => (p && p.id === id ? { ...p, is_available: !p.is_available } : p));
      fetchData({ silent: true });
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Failed to update product availability.'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/admin/products/${id}`);
      setShowPanel(false);
      fetchData({ silent: true });
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Failed to delete product.'));
    }
  };

  const counts = useMemo(() => {
    const c = { all: products.length };
    categories.forEach((k) => { c[String(k.id)] = products.filter((p) => productCategoryId(p) === String(k.id)).length; });
    return c;
  }, [products, categories]);

  const visible = products.filter((p) =>
    (cat === 'all' || productCategoryId(p) === cat) &&
    (status === 'all' || (status === 'available') === Boolean(p.is_available)) &&
    (p.name || '').toLowerCase().includes(q));

  if (loading) return <CoffeeLoader fullScreen={false} title="Brewing your menu" />;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 xl:flex-row">
      <div className="min-w-0 flex-1">
        {loadError && (
          <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>{loadError}</p>
            <Button variant="secondary" onClick={() => fetchData()} className="shrink-0 !py-1.5">Retry</Button>
          </div>
        )}

        {/* Categories */}
        <h1 className="text-lg font-bold text-stone-900">Categories</h1>
        <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-2">
          {[{ id: 'all', name: 'All menu' }, ...categories].map((c) => {
            const id = String(c.id);
            const active = cat === id;
            return (
              <button key={id} type="button" onClick={() => setCat(id)} aria-pressed={active}
                className={`flex w-24 shrink-0 flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${
                  active ? 'border-[#ef5a3c] bg-[#fff1ed]' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${active ? 'bg-[#ef5a3c] text-white' : 'bg-stone-100 text-stone-500'}`}>
                  <Icon name="cup" size={18} />
                </span>
                <span className="w-full truncate text-sm font-semibold text-stone-900">{c.name}</span>
                <span className="text-xs text-stone-500">{counts[id] ?? 0} items</span>
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-stone-900">Products</h2>
          <div className="flex items-center gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#ef5a3c]/20">
              <option value="all">All status</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
            <Button icon="plus" onClick={openCreate}>Add product</Button>
          </div>
        </div>

        {/* Grid */}
        {visible.length === 0 ? (
          !loadError && (
            <EmptyState title={products.length === 0 ? 'Add your first product' : 'No products found'}
              description={products.length === 0 ? 'Products you add here appear in your Mini App menu.' : 'Try another category, status, or search.'}
              action={<Button icon="plus" onClick={openCreate}>Add product</Button>} />
          )
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
            {visible.map((p) => {
              const selected = showPanel && editingProduct?.id === p.id;
              return (
                <li key={p.id}
                  className={`overflow-hidden rounded-2xl border bg-white transition-shadow hover:shadow-md ${selected ? 'border-[#ef5a3c] ring-2 ring-[#ef5a3c]/20' : 'border-stone-200'}`}>
                  <button type="button" onClick={() => openEdit(p)}
                    className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">
                    <Thumb src={p.image_url} alt={p.name} className={`aspect-[4/3] w-full ${p.is_available ? '' : 'opacity-50'}`} />
                    <div className="p-3 pb-2">
                      <p className="truncate text-sm font-semibold text-stone-900">{p.name}</p>
                      <p className="truncate text-xs text-stone-500">{p.category?.name || 'Uncategorized'}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-base font-bold text-stone-900">${Number(p.price).toFixed(2)}</span>
                        {p.requires_sugar && <Badge tone="amber">Sugar option</Badge>}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center justify-between border-t border-stone-100 px-3 py-2">
                    <Badge tone={p.is_available ? 'green' : 'red'}>{p.is_available ? 'Available' : 'Unavailable'}</Badge>
                    <Toggle checked={Boolean(p.is_available)} onChange={() => toggleAvailability(p.id)} label={`Availability of ${p.name}`} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add / edit panel: sidebar on wide screens, bottom sheet on small ones */}
      <aside aria-label="Product details"
        className={`${showPanel ? 'fixed inset-0 z-50 flex items-end bg-black/40 xl:static xl:z-auto xl:block xl:bg-transparent' : 'hidden xl:block'} w-full shrink-0 xl:sticky xl:top-6 xl:w-80 xl:self-start`}
        onClick={(e) => { if (e.target === e.currentTarget) setShowPanel(false); }}>
        <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-stone-200 bg-white p-5 xl:max-h-none xl:rounded-2xl">
          {!showPanel ? (
            <EmptyState icon="cup" title="Select a product" description="Pick a product to edit it, or add a new one for your Mini App."
              action={<Button icon="plus" onClick={openCreate}>Add product</Button>} />
          ) : (
            <form onSubmit={handleSaveProduct}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-stone-900">{editingProduct ? 'Edit product' : 'New product'}</h2>
                <button type="button" onClick={() => setShowPanel(false)} aria-label="Close"
                  className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
                  <Icon name="close" size={18} />
                </button>
              </div>

              {error && <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

              <Thumb src={form.imageUrl} className="mt-4 aspect-[4/3] w-full rounded-xl" />

              <div className="mt-4 space-y-3">
                <label className="block text-sm font-medium text-stone-700">Product name
                  <input className={`${input} mt-1`} type="text" required value={form.name}
                    onChange={(e) => setField('name', e.target.value)} placeholder="Iced latte" />
                </label>
                <label className="block text-sm font-medium text-stone-700">Category
                  <select className={`${input} mt-1`} required value={form.categoryId} onChange={(e) => setField('categoryId', e.target.value)}>
                    <option value="">Select a category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-stone-700">Price ($)
                  <input className={`${input} mt-1`} type="number" step="0.01" min="0" required value={form.price}
                    onChange={(e) => setField('price', e.target.value)} placeholder="2.50" />
                </label>
                <label className="block text-sm font-medium text-stone-700">Image URL
                  <input className={`${input} mt-1`} type="url" value={form.imageUrl}
                    onChange={(e) => setField('imageUrl', e.target.value)} placeholder="https://example.com/image.jpg" />
                </label>

                <div className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2.5">
                  <span className="text-sm text-stone-700">
                    <span className="block font-medium">Ask for sugar level</span>
                    <span className="block text-xs text-stone-500">For coffees and teas</span>
                  </span>
                  <Toggle checked={form.requiresSugar} onChange={() => setField('requiresSugar', !form.requiresSugar)} label="Requires sugar selection" />
                </div>

                {editingProduct && (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2.5">
                    <span className="text-sm font-medium text-stone-700">Available in Mini App</span>
                    <Toggle checked={Boolean(editingProduct.is_available)} onChange={() => toggleAvailability(editingProduct.id)} label="Available in Mini App" />
                  </div>
                )}
              </div>

              <div className="mt-5 flex gap-2">
                {editingProduct && (
                  <Button variant="secondary" icon="trash" onClick={() => handleDelete(editingProduct.id)} className="!text-rose-600">Delete</Button>
                )}
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? 'Saving…' : editingProduct ? 'Save changes' : 'Add product'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}