import React, { useEffect, useState } from 'react';
import api from '../../api/axios';

export default function ReportsPage() {
  const [salesData, setSalesData] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const [salesRes, productsRes] = await Promise.all([
        api.get('/admin/reports/sales', { params }),
        api.get('/admin/reports/products', { params })
      ]);

      setSalesData(salesRes.data);
      setTopProducts(productsRes.data.data);
    } catch (err) {
      console.error('Failed to load report analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchReports();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Sales & Product Reports</h1>

      {/* Filter Form */}
      <form onSubmit={handleFilterSubmit} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Date From</label>
          <input 
            type="date" 
            value={dateFrom} 
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Date To</label>
          <input 
            type="date" 
            value={dateTo} 
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="self-end">
          <button 
            type="submit" 
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-lg text-sm transition shadow"
          >
            Apply Filter
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-gray-500">Compiling report metrics...</p>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Total Revenue</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">${salesData?.total_revenue?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Total Orders Placed</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{salesData?.total_orders || 0}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Active Customers</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{salesData?.total_customers || 0}</p>
            </div>
          </div>

          {/* Top Products Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Top-Selling Products</h3>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                  <th className="pb-3">Product Name</th>
                  <th className="pb-3 text-center">Total Quantity Sold</th>
                  <th className="pb-3 text-right">Total Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {topProducts.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-3 font-semibold text-gray-800">{item.product_name}</td>
                    <td className="py-3 text-center text-gray-600">{item.total_quantity}</td>
                    <td className="py-3 text-right font-medium text-emerald-600">${Number(item.total_revenue).toFixed(2)}</td>
                  </tr>
                ))}
                {topProducts.length === 0 && (
                  <tr>
                    <td colSpan="3" className="py-6 text-center text-gray-500">No product sales found for this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}