import React, { useState } from 'react';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/admin/register', formData);
      if (typeof response.data?.token !== 'string' || !response.data.token) {
        throw new Error('The server did not return an authentication token.');
      }
      localStorage.setItem('admin_token', response.data.token);
      localStorage.removeItem('token');
      window.location.href = '/admin/dashboard';
    } catch (err) {
      setError(getApiErrorMessage(err, 'Registration failed. Please check your inputs.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Create Admin Account</h1>
          <p className="text-xs text-gray-500 mt-1">Set up your credentials to manage the system.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-medium border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
            <input 
              type="text" 
              name="name"
              required 
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
            <input 
              type="email" 
              name="email"
              required 
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
              placeholder="admin@ordercafe.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
            <input 
              type="password" 
              name="password"
              required 
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Confirm Password</label>
            <input 
              type="password" 
              name="password_confirmation"
              required 
              value={formData.password_confirmation}
              onChange={handleChange}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs shadow transition disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500">
          Already have an account? <a href="/admin/login" className="text-emerald-600 font-semibold hover:underline">Sign In</a>
        </p>
      </div>
    </div>
  );
}