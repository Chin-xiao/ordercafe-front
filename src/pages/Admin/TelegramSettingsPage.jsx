// src/pages/Admin/TelegramSettingsPage.jsx
import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import {
  Icon,
  PageHeader,
  Card,
  StatCard,
  Button,
  Badge,
  input,
} from '../../components/ui';
import CoffeeLoader from '../../components/CoffeeLoader';

export default function TelegramSettingsPage() {
  const [setting, setSetting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchSettings = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError('');
      const res = await api.get('/admin/telegram-settings');
      setSetting(res.data.data || res.data);
    } catch (err) {
      console.error('Failed to load telegram settings', err);
      setError(
        err.response?.data?.message ||
        getApiErrorMessage(err, 'Failed to load Telegram connection details.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    // Poll quietly every 15 seconds to automatically update when the group is linked
    const interval = setInterval(() => fetchSettings({ silent: true }), 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRegenerate = async () => {
    if (!window.confirm('Generate a new setup token? Existing linked groups will remain connected.')) {
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      setNotice('');
      const res = await api.post('/admin/telegram-settings/regenerate');
      setSetting(res.data.data || res.data);
      setNotice('New verification token generated successfully.');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        getApiErrorMessage(err, 'Failed to regenerate verification token.')
      );
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !setting) {
    return (
      <CoffeeLoader
        fullScreen={false}
        title="Brewing bot settings"
        message="Fetching Telegram connection details."
      />
    );
  }

  const setupCommand = setting?.setup_command;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telegram bot"
        description="Connect your Telegram group to receive real-time cafe order notifications."
      />

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <Icon name="close" size={18} className="shrink-0 text-rose-500" />
            <p>{error}</p>
          </div>
          <Button
            variant="secondary"
            className="self-start sm:self-auto min-h-[36px] px-3 py-1.5 text-xs"
            onClick={() => fetchSettings()}
          >
            Retry
          </Button>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <div className="flex items-center gap-2.5">
            <Icon name="check" size={18} className="shrink-0 text-emerald-600" />
            <p>{notice}</p>
          </div>
          <button
            type="button"
            onClick={() => setNotice('')}
            aria-label="Dismiss notice"
            className="rounded-lg p-1 text-emerald-700 transition-colors hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {/* Status overview cards */}
      <section aria-label="Bot status summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Bot connection"
          value={setting?.is_verified ? 'Verified' : 'Pending'}
          hint={
            setting?.is_verified
              ? 'Bot is actively sending notifications'
              : 'Waiting for setup command in group'
          }
          icon="bot"
          tone={setting?.is_verified ? 'green' : 'amber'}
        />
        <StatCard
          label="Linked group"
          value={setting?.group_name || (setting?.is_verified ? 'Telegram group' : 'Not linked')}
          hint={
            setting?.chat_id
              ? `Chat ID: ${setting.chat_id}`
              : 'No group chat connected yet'
          }
          icon="message"
          tone={setting?.is_verified ? 'blue' : 'rose'}
        />
      </section>

      {/* Setup Instructions Card */}
      <Card
        title="Link your Telegram group"
        action={
          <Badge tone={setting?.is_verified ? 'green' : 'amber'}>
            {setting?.is_verified ? 'Active connection' : 'Pending link'}
          </Badge>
        }
      >
        <div className="space-y-5">
          {setupCommand ? (
            <>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-stone-900">Follow these steps:</h3>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-600">
                  <li>
                    Add your Telegram bot to your group chat and promote it to{' '}
                    <strong className="font-semibold text-stone-900">Administrator</strong>.
                  </li>
                  <li>
                    Click <strong className="font-semibold text-stone-900">Copy command</strong> below
                    to copy your unique setup key.
                  </li>
                  <li>
                    Paste and send the command directly in your Telegram group chat.
                  </li>
                </ol>
              </div>

              <div className="space-y-1.5 pt-2">
                <label
                  htmlFor="telegram-setup-command"
                  className="block text-xs font-semibold text-stone-600"
                >
                  {setting?.is_verified
                    ? 'Setup command for another group'
                    : 'Your setup command'}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    id="telegram-setup-command"
                    type="text"
                    readOnly
                    value={setupCommand}
                    className={`${input} font-mono text-xs sm:text-sm text-stone-800`}
                  />
                  <Button
                    variant="primary"
                    icon={copied ? 'check' : undefined}
                    onClick={() => copyToClipboard(setupCommand)}
                    className="min-h-[40px] shrink-0 whitespace-nowrap"
                  >
                    {copied ? 'Copied' : 'Copy command'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-stone-500">
              Your group is linked and verified. Generate a setup token only if you want to connect
              another Telegram group.
            </p>
          )}

          <div className="flex flex-col gap-3 border-t border-stone-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-stone-500">
              Need to link another group? Generate an additional setup token.
            </p>
            <Button
              variant="secondary"
              disabled={actionLoading}
              onClick={handleRegenerate}
              className="min-h-[38px] text-xs font-semibold"
            >
              {actionLoading
                ? 'Generating…'
                : setupCommand
                  ? 'Generate another token'
                  : 'Generate setup token'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
