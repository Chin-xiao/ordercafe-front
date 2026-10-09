import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import {
  formatDateTime,
  formatRemainingTime,
  getSessionStatus,
  unwrapApiData,
} from '../../utils/orderSession';

const getFinalReport = (data) => {
  const report = data?.final_report ?? data?.report ?? data?.summary;
  if (typeof report === 'string') return report;
  return report && typeof report === 'object' ? JSON.stringify(report, null, 2) : '';
};

const getSessionMetrics = (session) => Object.entries(session)
  .filter(([key, value]) => (
    /(?:order|customer).*count|count.*(?:order|customer)/i.test(key)
    && typeof value === 'number'
  ));

const getSessionDeliveryFields = (session) => Object.entries(session)
  .filter(([key, value]) => (
    /telegram/i.test(key)
    && /(announcement|delivery|sent|delivered)/i.test(key)
    && (typeof value === 'string' || typeof value === 'boolean')
  ));

const formatBackendResponse = (data) => JSON.stringify(data, (key, value) => (
  /token|secret|password/i.test(key) ? '[redacted]' : value
), 2);

const INITIAL_NOW = Date.now();

export default function OrderSessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [formError, setFormError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [finalReport, setFinalReport] = useState('');
  const [now, setNow] = useState(INITIAL_NOW);
  const [title, setTitle] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

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
      return null;
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
    setFeedback(null);
    try {
      await api.post('/admin/order-sessions', {
        title: title.trim(),
        expires_at: expirationDate.toISOString(),
      });
      setTitle('');
      setExpiresAt('');
      setShowModal(false);
      setFeedback({ type: 'success', sessionMessage: 'Order session created as a draft.' });
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
    setFeedback(null);
    try {
      const response = await api.post(`/admin/order-sessions/${id}/start`);
      const responseData = unwrapApiData(response);
      const result = responseData && typeof responseData === 'object' ? responseData : {};
      const refreshedSessions = await fetchSessions();
      const refreshedSession = refreshedSessions?.find((session) => String(session.id) === String(id));
      const sessionStarted = result.success !== false
        && String(refreshedSession?.status || '').toUpperCase() === 'OPEN';
      const responseDetails = responseData === null
        ? ''
        : typeof responseData === 'string'
          ? responseData
          : formatBackendResponse(responseData);
      setFeedback({
        type: sessionStarted ? 'success' : 'warning',
        sessionMessage: sessionStarted
          ? (typeof result.message === 'string' ? result.message : 'Order session started successfully.')
          : (typeof result.message === 'string'
            ? result.message
            : 'The start request was accepted, but the refreshed status does not confirm that the session is open.'),
        deliveryMessage: 'Telegram announcement delivery is not inferred from HTTP success. See the backend response below if it reports delivery.',
        responseDetails,
      });
    } catch (err) {
      const requestMessage = getApiErrorMessage(err, 'Failed to start the order session.');
      const statusCode = err.response?.status;
      if (!err.response || statusCode >= 500) {
        const refreshedSessions = await fetchSessions();
        const refreshedSession = refreshedSessions?.find((session) => String(session.id) === String(id));
        const reconciledStatus = refreshedSession
          ? String(refreshedSession.status || 'unknown').toUpperCase()
          : 'unavailable';
        setError(
          `${requestMessage} The start request was not retried. Refreshed session status: ${reconciledStatus}.`
        );
      } else {
        setError(requestMessage);
      }
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
    setFeedback(null);
    setFinalReport('');
    try {
      const response = await api.post(`/admin/order-sessions/${session.id}/close`);
      const responseData = unwrapApiData(response);
      const result = responseData && typeof responseData === 'object' ? responseData : {};
      if (result.success === false) {
        throw new Error(result.message || 'The backend did not confirm that the session closed.');
      }

      const refreshedSessions = await fetchSessions();
      const refreshedSession = refreshedSessions?.find((item) => String(item.id) === String(session.id));
      setFinalReport(getFinalReport(result) || getFinalReport(refreshedSession));
      const sessionClosed = result.success !== false && (
        result.success === true
        || String(result.status || '').toUpperCase() === 'CLOSED'
        || String(refreshedSession?.status || '').toUpperCase() === 'CLOSED'
      );
      setFeedback({
        type: sessionClosed ? 'success' : 'warning',
        sessionMessage: sessionClosed
          ? (typeof result.message === 'string' ? result.message : 'Order session closed successfully.')
          : 'The close request was accepted, but the refreshed status does not confirm that the session is closed.',
        deliveryMessage: 'Telegram report delivery is not inferred from HTTP success. Check the backend response for its delivery result.',
      });
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
      <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Cafe operations</p>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">Order sessions</h1>
          <p className="text-sm text-gray-500 mt-1">Create ordering windows and manage their status.</p>
        </div>
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
      {feedback?.responseDetails && (
        <details className="mb-4 rounded-lg border border-gray-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-gray-800">Backend response details</summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700">
            {feedback.responseDetails}
          </pre>
        </details>
      )}
      {feedback && (
        <div role="status" className={`mb-4 rounded-lg border p-4 text-sm ${
          feedback.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}>
          <p className="font-semibold">{feedback.sessionMessage}</p>
          {feedback.deliveryMessage && (
            <p className={`mt-1 ${feedback.deliveryType === 'failed' ? 'font-semibold' : ''}`}>
              {feedback.deliveryMessage}
            </p>
          )}
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

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5" aria-label="Session overview">
        {[
          ['Loaded sessions', sessions.length],
          ['Draft', sessions.filter((session) => getSessionStatus(session, now) === 'DRAFT').length],
          ['Open', sessions.filter((session) => getSessionStatus(session, now) === 'OPEN').length],
          ['Closed / expired', sessions.filter((session) => ['CLOSED', 'EXPIRED'].includes(getSessionStatus(session, now))).length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </section>

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
                      <div>Expires: <span className="font-medium text-gray-800">{formatDateTime(session.expires_at)}</span></div>
                      {getSessionMetrics(session).map(([key, value]) => (
                        <div key={key}>{key.replaceAll('_', ' ')}: <span className="font-medium text-gray-800">{value}</span></div>
                      ))}
                      {getSessionDeliveryFields(session).map(([key, value]) => (
                        <div key={key}>{key.replaceAll('_', ' ')}: <span className="font-medium text-gray-800">{String(value)}</span></div>
                      ))}
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
