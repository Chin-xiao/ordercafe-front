// src/pages/Admin/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import { formatDateTime, unwrapApiData } from '../../utils/orderSession';
import { Icon, PageHeader, Card, StatCard, Button, Badge, EmptyState } from '../../components/ui';
import CoffeeLoader from '../../components/CoffeeLoader';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [closing, setClosing] = useState(false);

  const fetchDashboard = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError('');
      const res = await api.get('/admin/dashboard');
      if (!res.data || typeof res.data !== 'object' || Array.isArray(res.data)) {
        throw new Error('The API returned an invalid dashboard response.');
      }
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
      setStats(null);
      setError(getApiErrorMessage(err, 'Failed to load dashboard data.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialFetch = window.setTimeout(() => fetchDashboard(), 0);
    return () => window.clearTimeout(initialFetch);
  }, []);

  const handleCloseSession = async (sessionId) => {
    if (closing) return;
    if (!window.confirm('Are you sure you want to close this session? This will lock ordering and notify Telegram.')) return;

    setClosing(true);
    setError('');
    setNotice('');
    try {
      const response = await api.post(`/admin/order-sessions/${sessionId}/close`);
      const result = unwrapApiData(response) || {};
      if (result.success === false) {
        throw new Error(result.message || 'The backend did not confirm that the session closed.');
      }
      const deliveryFlag = [
        'telegram_message_sent',
        'telegram_sent',
        'telegram_delivered',
        'report_sent',
        'message_delivered',
      ].find((field) => typeof result[field] === 'boolean');
      const deliveryStatus = String(result.telegram_delivery_status || result.delivery_status || '').toLowerCase();
      const deliveryConfirmed = deliveryFlag
        ? result[deliveryFlag]
        : ['sent', 'delivered', 'success', 'succeeded'].includes(deliveryStatus);
      const deliveryFailed = deliveryFlag
        ? !result[deliveryFlag]
        : ['failed', 'error'].includes(deliveryStatus);
      const deliveryMessage = deliveryConfirmed
        ? ' Telegram report delivery was confirmed by the backend.'
        : deliveryFailed
          ? ' Telegram report delivery failed; check the bot configuration and group permissions.'
          : ' The API did not confirm Telegram report delivery.';
      setNotice(`Session closed.${deliveryMessage}`);
      await fetchDashboard({ silent: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to close session.'));
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <CoffeeLoader
        fullScreen={false}
        title="Brewing your metrics"
        message="Fetching today's sales and active session overview."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of today's sales, customer orders, and active sessions."
      >
        <Button
          variant="secondary"
          icon="clock"
          onClick={() => navigate('/admin/sessions')}
          className="min-h-[40px]"
        >
          Order sessions
        </Button>
      </PageHeader>

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
            className="self-start sm:self-auto min-h-[36px] text-xs px-3 py-1.5"
            onClick={() => fetchDashboard()}
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

      {stats && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
            <StatCard
              label="Today's orders"
              value={stats?.today_orders || 0}
              hint="Total orders placed today"
              icon="receipt"
              tone="blue"
            />
            <StatCard
              label="Today's customers"
              value={stats?.today_customers || 0}
              hint="Unique customers today"
              icon="users"
              tone="amber"
            />
            <StatCard
              label="Today's revenue"
              value={`$${Number(stats?.today_revenue || 0).toFixed(2)}`}
              hint="Gross earnings today"
              icon="coins"
              tone="green"
            />
          </div>

          {/* Active Order Session Panel */}
          <Card
            title="Active order session"
            action={
              stats?.active_session ? (
                <Badge tone="green">Active</Badge>
              ) : (
                <Badge tone="gray">Inactive</Badge>
              )
            }
          >
            {stats?.active_session ? (
              <div className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-stone-50/70 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-stone-900">
                      {stats.active_session.title}
                    </h3>
                    {stats.active_session.order_number && (
                      <span className="rounded bg-stone-200/80 px-2 py-0.5 font-mono text-xs font-semibold text-stone-700">
                        #{stats.active_session.order_number}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                    <span>
                      Started: <strong className="font-medium text-stone-700">{formatDateTime(stats.active_session.started_at)}</strong>
                    </span>
                    <span>
                      Expires: <strong className="font-medium text-stone-700">{formatDateTime(stats.active_session.expires_at)}</strong>
                    </span>
                  </div>
                </div>

                <Button
                  variant="danger"
                  onClick={() => handleCloseSession(stats.active_session.id)}
                  disabled={closing}
                  className="min-h-[40px] shrink-0 self-start md:self-center"
                >
                  {closing ? 'Ending session…' : 'End session'}
                </Button>
              </div>
            ) : (
              <EmptyState
                icon="clock"
                title="No active order session"
                description="There is no active session taking orders right now."
                action={
                  <Button
                    variant="primary"
                    icon="plus"
                    onClick={() => navigate('/admin/sessions')}
                    className="min-h-[40px]"
                  >
                    Start new session
                  </Button>
                }
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
