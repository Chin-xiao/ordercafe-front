// src/pages/Admin/ProductsPage.jsx
import React, { useEffect, useState } from 'react';
import api from '../../api/axios';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/admin/products');
      setProducts(res.data.data || res.data);
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const toggleAvailability = async (id) => {
    try {
      await api.patch(`/admin/products/${id}/availability`);
      fetchProducts();
    } catch (err) {
      alert('Failed to update product availability.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/admin/products/${id}`);
      fetchProducts();
    } catch (err) {
      alert('Failed to delete product.');
    }
  };

  if (loading) return <div className="p-4 text-gray-500">Loading products...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Product Management</h1>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg shadow transition">
          + Add New Product
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
              <th className="p-4">Image</th>
              <th className="p-4">Product Name</th>
              <th className="p-4">Category</th>
              <th className="p-4">Price</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="p-4">
                  <img 
                    src={product.image_url || 'https://via.placeholder.com/50'} 
                    alt={product.name} 
                    className="w-12 h-12 object-cover rounded-md border"
                  />
                </td>
                <td className="p-4 font-semibold text-gray-800">{product.name}</td>
                <td className="p-4 text-gray-600">{product.category?.name || 'Uncategorized'}</td>
                <td className="p-4 font-medium text-gray-900">${Number(product.price).toFixed(2)}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${product.is_available ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {product.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  <button 
                    onClick={() => toggleAvailability(product.id)}
                    className="text-blue-600 hover:underline text-xs font-medium"
                  >
                    Toggle Status
                  </button>
                  <button 
                    onClick={() => handleDelete(product.id)}
                    className="text-red-600 hover:underline text-xs font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan="6" className="p-8 text-center text-gray-500">No products found. Add your first item!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}