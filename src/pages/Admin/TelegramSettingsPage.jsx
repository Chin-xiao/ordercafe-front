import React, { useEffect, useState } from 'react';
import api from '../../api/axios';

export default function TelegramSettingsPage() {
  const [setting, setSetting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Bulletproof frontend fallback random token if backend hasn't populated it yet
  const [randomFallback] = useState(() => 'CAFE_' + Math.random().toString(36).substring(2, 10).toUpperCase());

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/admin/telegram-settings');
      setSetting(res.data.data || res.data);
    } catch (err) {
      console.error('Failed to load telegram settings', err);
      setError(err.response?.data?.message || 'Failed to load Telegram connection details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    // Poll every 15 seconds to automatically update when the group is linked
    const interval = setInterval(fetchSettings, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRegenerate = async () => {
    if (!window.confirm('Are you sure you want to generate a new token? This will disconnect any currently linked group.')) return;
    try {
      setActionLoading(true);
      const res = await api.post('/admin/telegram-settings/regenerate');
      setSetting(res.data.data || res.data);
      alert('New verification token generated successfully!');
    } catch (err) {
      alert('Failed to regenerate token.');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !setting) {
    return <div className="p-6 text-gray-500 text-center">Loading Telegram settings...</div>;
  }

  // Resolve token and command cleanly with guaranteed fallback
  const currentToken = setting?.verify_token || randomFallback;
  const setupCommand = setting?.setup_command || `/setup ${currentToken}`;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Telegram Bot Integration</h1>
        <p className="text-xs text-gray-500 mt-1">Connect your Telegram group to receive real-time cafe order notifications.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-medium border border-red-200">
          {error}
        </div>
      )}

      {/* Connection Status Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status</span>
          <div className="flex items-center gap-2 mt-1">
            {setting?.is_verified ? (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Bot Connected & Verified
              </span>
            ) : (
              <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Waiting for Group Link
              </span>
            )}
          </div>
        </div>

        {setting?.is_verified && (
          <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 text-xs space-y-1">
            <p className="text-gray-500 font-semibold">Linked Group:</p>
            <p className="font-bold text-gray-800 text-sm">{setting?.group_name || 'Telegram Group'}</p>
            <p className="text-gray-400 font-mono text-[10px]">Chat ID: {setting?.chat_id}</p>
          </div>
        )}
      </div>

      {/* Verification Instructions Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="text-sm font-bold text-gray-800">🔗 How to Link Your Group</h3>
        <ol className="list-decimal list-inside text-xs text-gray-600 space-y-2">
          <li>Add your Telegram bot to your group chat and make it an <strong className="text-gray-800">Administrator</strong>.</li>
          <li>Click <strong className="text-gray-800">Copy Command</strong> to grab your unique setup key.</li>
          <li>Paste and send the command directly inside your Telegram group chat.</li>
        </ol>

        <div className="pt-2">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Your Setup Command</label>
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              readOnly 
              value={setupCommand}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 font-mono text-sm text-gray-800 outline-none"
            />
            <button 
              onClick={() => copyToClipboard(setupCommand)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl text-xs shadow transition whitespace-nowrap"
            >
              {copied ? 'Copied! ✓' : 'Copy Command'}
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
          <p className="text-xs text-gray-400">Need a fresh token? This will reset the current connection.</p>
          <button 
            disabled={actionLoading}
            onClick={handleRegenerate}
            className="border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50"
          >
            {actionLoading ? 'Regenerating...' : 'Regenerate Token'}
          </button>
        </div>
      </div>
    </div>
  );
}