import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';

export default function UsersPage() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const canManagePaymentQr = currentUser.role === 'superadmin';
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingQr, setUploadingQr] = useState({});
  const [qrUploadErrors, setQrUploadErrors] = useState({});

  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('controller');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/users');
      const userList = response.data?.data ?? response.data;
      setUsers(Array.isArray(userList) ? userList : []);
      setError('');
    } catch (err) {
      console.error('Failed to fetch users', err);
      setError(getApiErrorMessage(err, 'Failed to load user list.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenCreateModal = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('controller');
    setFormError('');
    setShowModal(true);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      await api.post('/admin/users', {
        name,
        email,
        password,
        role,
      });

      setShowModal(false);
      fetchUsers();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Failed to create user.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user account?')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      fetchUsers();
    } catch (err) {
      alert(getApiErrorMessage(err, 'Failed to delete user.'));
    }
  };

  const handlePaymentQrUpload = async (userId, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (
      !allowedExtensions.includes(extension) ||
      (file.type && !allowedTypes.includes(file.type))
    ) {
      setQrUploadErrors((previous) => ({
        ...previous,
        [userId]: 'Choose a JPG, PNG, or WebP image.',
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setQrUploadErrors((previous) => ({
        ...previous,
        [userId]: 'The image must be no larger than 5 MB.',
      }));
      return;
    }

    setQrUploadErrors((previous) => ({ ...previous, [userId]: '' }));
    setUploadingQr((previous) => ({ ...previous, [userId]: true }));

    try {
      // 1. Upload directly to Cloudinary using your unsigned preset
      const cloudinaryFormData = new FormData();
      cloudinaryFormData.append('file', file);
      cloudinaryFormData.append('upload_preset', 'qr_uploads');

      const cloudinaryResponse = await fetch(
        'https://api.cloudinary.com/v1_1/djxniv0op/image/upload',
        {
          method: 'POST',
          body: cloudinaryFormData,
        }
      );

      const cloudinaryData = await cloudinaryResponse.json();

      if (!cloudinaryResponse.ok) {
        throw new Error(cloudinaryData?.error?.message || 'Failed to upload to Cloudinary');
      }

      const secureUrl = cloudinaryData.secure_url;

      // 2. Send the public URL to your Laravel backend to store in DB
      await api.post(`/admin/users/${userId}/payment-qr`, {
        payment_qr_url: secureUrl,
      });

      await fetchUsers();
    } catch (err) {
      setQrUploadErrors((previous) => ({
        ...previous,
        [userId]: getApiErrorMessage(err, 'Failed to upload payment QR image.'),
      }));
    } finally {
      setUploadingQr((previous) => ({ ...previous, [userId]: false }));
    }
  };

  if (loading) return <div className="p-6 text-gray-500 text-center">Loading users...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">User & Staff Management</h1>
        <button 
          onClick={handleOpenCreateModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg shadow transition text-sm"
        >
          + Add New User
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button onClick={fetchUsers} className="mt-2 font-semibold underline">Retry</button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
              <th className="p-4">Name</th>
              <th className="p-4">Email</th>
              <th className="p-4">Role</th>
              <th className="p-4">Created At</th>
              {canManagePaymentQr && <th className="p-4">Payment QR</th>}
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition">
                <td className="p-4 font-semibold text-gray-800">{user.name}</td>
                <td className="p-4 text-gray-600">{user.email}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${user.role === 'superadmin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-4 text-gray-500 text-xs">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                {canManagePaymentQr && (
                  <td className="p-4">
                    {user.is_admin || ['admin', 'superadmin'].includes(user.role) ? (
                      <div className="space-y-2">
                        {user.payment_qr_image_url && (
                          <img
                            src={user.payment_qr_image_url}
                            alt={`${user.name}'s payment QR code`}
                            className="h-20 w-20 rounded-lg border border-gray-200 object-contain"
                          />
                        )}
                        <label className="block text-xs font-semibold text-emerald-700">
                          {uploadingQr[user.id]
                            ? 'Uploading...'
                            : user.payment_qr_image_url
                              ? 'Replace QR image'
                              : 'Upload QR image'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                            disabled={uploadingQr[user.id]}
                            onChange={(event) => handlePaymentQrUpload(user.id, event)}
                            className="mt-1 block w-full text-xs font-normal text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100 disabled:opacity-50"
                          />
                        </label>
                        {qrUploadErrors[user.id] && (
                          <p role="alert" className="text-xs text-red-600">
                            {qrUploadErrors[user.id]}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                )}
                <td className="p-4 text-right">
                  <button 
                    onClick={() => handleDeleteUser(user.id)}
                    className="text-red-600 hover:underline text-xs font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && !error && (
              <tr>
                <td colSpan={canManagePaymentQr ? 6 : 5} className="p-8 text-center text-gray-500">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">Create New User</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            {formError && <div className="mb-4 text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">{formError}</div>}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Socheat Staff"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="controller@ordercafe.com"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">System Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                >
                  <option value="controller">Controller (Staff)</option>
                  <option value="superadmin">SuperAdmin</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow transition disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
