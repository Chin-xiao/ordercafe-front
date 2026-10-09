import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => (
    searchParams.get('reason') === 'session-expired'
      ? 'Your session has expired. Please sign in again.'
      : ''
  ));
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/admin/login', { email, password });
      if (typeof response.data?.token !== 'string' || !response.data.token) {
        throw new Error('The server did not return an authentication token.');
      }
      localStorage.setItem('admin_token', response.data.token);
      localStorage.removeItem('token');
      window.location.href = '/admin/dashboard';
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid login credentials.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Login</h1>
          <p className="text-xs text-gray-500 mt-1">Sign in to manage your cafe ordering system.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-medium border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
              placeholder="admin@ordercafe.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs shadow transition disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500">
          Don't have an account? <a href="/admin/register" className="text-emerald-600 font-semibold hover:underline">Register</a>
        </p>
      </div>
    </div>
  );
}