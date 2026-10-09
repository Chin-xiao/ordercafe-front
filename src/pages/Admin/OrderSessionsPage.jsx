import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import {
  formatDateTime,
  formatRemainingTime,
  getSessionStatus,
  unwrapApiData,
} from '../../utils/orderSession';

const getTelegramDelivery = (data) => {
  const flags = [
    'telegram_message_sent',
    'telegram_sent',
    'telegram_delivered',
    'telegram_report_sent',
    'announcement_sent',
    'report_sent',
    'message_delivered',
  ];
  const confirmedFlag = flags.find((field) => typeof data?.[field] === 'boolean');
  if (confirmedFlag) return data[confirmedFlag] ? 'confirmed' : 'failed';

  const status = String(data?.telegram_delivery_status || data?.delivery_status || '').toLowerCase();
  if (['sent', 'delivered', 'success', 'succeeded'].includes(status)) return 'confirmed';
  if (['failed', 'error'].includes(status)) return 'failed';
  return 'unknown';
};

const getFinalReport = (data) => {
  const report = data?.final_report ?? data?.report ?? data?.summary;
  if (typeof report === 'string') return report;
  return report && typeof report === 'object' ? JSON.stringify(report, null, 2) : '';
};

const INITIAL_NOW = Date.now();

export default function OrderSessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [finalReport, setFinalReport] = useState('');
  const [now, setNow] = useState(INITIAL_NOW);
  const [title, setTitle] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/admin/order-sessions');
      const sessionList = unwrapApiData(response);
      if (!Array.isArray(sessionList)) {
        throw new Error('The API returned an invalid order sessions response.');
      }
      setSessions(sessionList);
      return sessionList;
    } catch (err) {
      console.error('Failed to load order sessions', err);
      setSessions([]);
      setError(getApiErrorMessage(err, 'Failed to load order sessions.'));
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialFetch = window.setTimeout(fetchSessions, 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(timer);
    };
  }, []);

  const handleCreateSession = async (event) => {
    event.preventDefault();
    const expirationDate = new Date(expiresAt);
    if (!title.trim()) {
      setFormError('Enter a title for this ordering session.');
      return;
    }
    if (!expiresAt || Number.isNaN(expirationDate.getTime()) || expirationDate.getTime() <= Date.now()) {
      setFormError('Choose an expiration date and time in the future.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    setError('');
    setNotice('');
    try {
      await api.post('/admin/order-sessions', {
        title: title.trim(),
        expires_at: expirationDate.toISOString(),
        ...(announcementMessage.trim()
          ? { announcement_message: announcementMessage.trim() }
          : {}),
      });
      setTitle('');
      setExpiresAt('');
      setAnnouncementMessage('');
      setShowModal(false);
      setNotice('Order session created as a draft.');
      await fetchSessions();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Failed to create the order session.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartSession = async (id) => {
    if (actionId !== null) return;
    setActionId(id);
    setError('');
    setNotice('');
    try {
      const response = await api.post(`/admin/order-sessions/${id}/start`);
      const result = unwrapApiData(response) || {};
      if (result.success === false) {
        throw new Error(result.message || 'The backend did not confirm that the session started.');
      }

      const delivery = getTelegramDelivery(result);
      const responseMessage = typeof result.message === 'string' ? ` ${result.message}` : '';
      const deliveryMessage = delivery === 'confirmed'
        ? ' Telegram announcement delivery was confirmed by the backend.'
        : delivery === 'failed'
          ? ' The session started, but Telegram announcement delivery failed; check the bot configuration and group permissions.'
          : ' The session start was accepted, but the API did not confirm Telegram message delivery.';
      setNotice(`Session start accepted.${deliveryMessage}${responseMessage}`);
      await fetchSessions();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to start the order session.'));
    } finally {
      setActionId(null);
    }
  };

  const handleCloseSession = async (session) => {
    if (actionId !== null) return;
    const confirmed = window.confirm(
      `End ordering for "${session.title}"? Customers will no longer be able to submit orders.`
    );
    if (!confirmed) return;

    setActionId(session.id);
    setError('');
    setNotice('');
    setFinalReport('');
    try {
      const response = await api.post(`/admin/order-sessions/${session.id}/close`);
      const result = unwrapApiData(response) || {};
      if (result.success === false) {
        throw new Error(result.message || 'The backend did not confirm that the session closed.');
      }

      const refreshedSessions = await fetchSessions();
      const refreshedSession = refreshedSessions.find((item) => item.id === session.id);
      setFinalReport(getFinalReport(result) || getFinalReport(refreshedSession));
      const delivery = getTelegramDelivery(result);
      const reportMessage = delivery === 'confirmed'
        ? ' Telegram report delivery was confirmed by the backend.'
        : delivery === 'failed'
          ? ' The session closed, but Telegram report delivery failed; check the bot configuration and group permissions.'
          : ' The session closed, but the API did not confirm Telegram report delivery.';
      const responseMessage = typeof result.message === 'string' ? ` ${result.message}` : '';
      setNotice(`Session closed.${reportMessage}${responseMessage}`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to close the order session.'));
    } finally {
      setActionId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">🟢 OPEN</span>;
      case 'CLOSED':
        return <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">🔴 CLOSED</span>;
      case 'EXPIRED':
        return <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">⌛ EXPIRED</span>;
      case 'DRAFT':
        return <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">⏳ DRAFT</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">{status}</span>;
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Order Sessions Management</h1>
        <button
          onClick={() => { setFormError(''); setShowModal(true); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-sm shadow transition"
        >
          + Create New Session
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button onClick={fetchSessions} className="mt-2 font-semibold underline">Retry</button>
        </div>
      )}
      {notice && (
        <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {finalReport && (
        <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="font-bold text-gray-800 mb-2">Final order report returned by the backend</h2>
          <pre className="whitespace-pre-wrap break-words text-sm text-gray-700">{finalReport}</pre>
        </section>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Create Order Session</h3>
            {formError && <p role="alert" className="mb-4 text-sm text-red-700">{formError}</p>}
            <form onSubmit={handleCreateSession}>
              <div className="mb-4">
                <label htmlFor="session-title" className="block text-xs font-semibold text-gray-500 mb-1">Session Title</label>
                <input
                  id="session-title"
                  type="text"
                  required
                  maxLength={255}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Lunch Order"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="session-expiration" className="block text-xs font-semibold text-gray-500 mb-1">Expiration Date and Time</label>
                <input
                  id="session-expiration"
                  type="datetime-local"
                  required
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="session-announcement" className="block text-xs font-semibold text-gray-500 mb-1">Announcement Message (optional)</label>
                <textarea
                  id="session-announcement"
                  value={announcementMessage}
                  onChange={(event) => setAnnouncementMessage(event.target.value)}
                  rows="3"
                  placeholder="Add a note for customers in the Telegram group"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 text-sm font-semibold hover:bg-gray-100 rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        {loading ? (
          <p className="p-6 text-gray-500 text-center">Loading sessions...</p>
        ) : (
          <table className="w-full min-w-[850px] text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold bg-gray-50">
                <th className="p-4">Session</th>
                <th className="p-4">Order Number</th>
                <th className="p-4">Status</th>
                <th className="p-4">Schedule</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {sessions.map((session) => {
                const status = getSessionStatus(session, now);
                return (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="p-4 font-semibold text-gray-800">{session.title}</td>
                    <td className="p-4 font-mono text-gray-600">{session.order_number || '—'}</td>
                    <td className="p-4">{getStatusBadge(status)}</td>
                    <td className="p-4 text-gray-600">
                      <div>Started: {formatDateTime(session.started_at)}</div>
                      <div>Expires: {formatDateTime(session.expires_at)}</div>
                      {status === 'OPEN' && (
                        <div className="font-semibold text-emerald-700">
                          Remaining: {formatRemainingTime(session.expires_at, now)}
                        </div>
                      )}
                      {session.closed_at && <div>Closed: {formatDateTime(session.closed_at)}</div>}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {status === 'DRAFT' && (
                        <button
                          onClick={() => handleStartSession(session.id)}
                          disabled={actionId !== null}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg text-xs shadow transition disabled:opacity-50"
                        >
                          {actionId === session.id ? 'Starting...' : '🚀 Start Session'}
                        </button>
                      )}
                      {status === 'OPEN' && (
                        <button
                          onClick={() => handleCloseSession(session)}
                          disabled={actionId !== null}
                          className="bg-red-600 hover:bg-red-700 text-white font-medium px-3 py-1.5 rounded-lg text-xs shadow transition disabled:opacity-50"
                        >
                          {actionId === session.id ? 'Ending...' : '🛑 End Order'}
                        </button>
                      )}
                      {(status === 'CLOSED' || status === 'EXPIRED') && (
                        <span className="text-xs text-gray-400 font-medium italic">Completed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!error && sessions.length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-gray-500">No order sessions created yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
