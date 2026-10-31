// src/pages/Admin/OrderSessionsPage.jsx
import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import {
  formatDateTime,
  formatRemainingTime,
  getSessionStatus,
  unwrapApiData,
} from '../../utils/orderSession';
import {
  Icon,
  PageHeader,
  Card,
  StatCard,
  Button,
  Badge,
  EmptyState,
  tableWrap,
  table,
  th,
  td,
  tr,
  input,
} from '../../components/ui';
import CoffeeLoader from '../../components/CoffeeLoader';

const getFinalReport = (data) => {
  const report = data?.final_report ?? data?.report ?? data?.summary;
  if (typeof report === 'string') return report;
  return report && typeof report === 'object' ? JSON.stringify(report, null, 2) : '';
};

const getSessionMetrics = (session) =>
  Object.entries(session).filter(
    ([key, value]) =>
      /(?:order|customer).*count|count.*(?:order|customer)/i.test(key) &&
      typeof value === 'number'
  );

const getSessionDeliveryFields = (session) =>
  Object.entries(session).filter(
    ([key, value]) =>
      (/telegram/i.test(key) || /announcement/i.test(key)) &&
      /(announcement|delivery|sent|delivered|status)/i.test(key) &&
      (typeof value === 'string' || typeof value === 'boolean')
  );

const getAnnouncementDeliveryFeedback = (responseData) => {
  if (!responseData || typeof responseData !== 'object') return null;

  const fields = getSessionDeliveryFields(responseData);
  if (fields.length === 0) return null;

  const fieldDetails = fields.map(([key, value]) => `${key}: ${String(value)}`).join(', ');
  const deliveryFailed = fields.some(
    ([, value]) =>
      value === false || (typeof value === 'string' && /fail|error|undelivered/i.test(value))
  );

  return {
    type: deliveryFailed ? 'failed' : 'reported',
    message: deliveryFailed
      ? `Telegram announcement delivery failed (${fieldDetails}). Check the bot's group permissions and retry only after confirming the session state.`
      : `Telegram announcement delivery reported by the backend (${fieldDetails}).`,
  };
};

const formatBackendResponse = (data) =>
  JSON.stringify(
    data,
    (key, value) => (/token|secret|password/i.test(key) ? '[redacted]' : value),
    2
  );

const INITIAL_NOW = Date.now();
const MESSAGE_LIMIT = 4096;

export default function OrderSessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [formError, setFormError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [messageSession, setMessageSession] = useState(null);
  const [groupMessage, setGroupMessage] = useState('');
  const [groupMessageError, setGroupMessageError] = useState('');
  const [sendingGroupMessage, setSendingGroupMessage] = useState(false);
  const [finalReport, setFinalReport] = useState('');
  const [now, setNow] = useState(INITIAL_NOW);
  const [title, setTitle] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const fetchSessions = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
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
    const initialFetch = window.setTimeout(() => fetchSessions(), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!showModal && !messageSession) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setShowModal(false);
        setMessageSession(null);
        setGroupMessage('');
        setGroupMessageError('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal, messageSession]);

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
      await fetchSessions({ silent: true });
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
      const responseBody = response.data && typeof response.data === 'object' ? response.data : {};
      if (responseBody.success === false || responseBody.session_started === false) {
        throw new Error(responseBody.message || 'The backend did not confirm that the order session started.');
      }
      const refreshedSessions = await fetchSessions({ silent: true });
      const refreshedSession = refreshedSessions?.find((session) => String(session.id) === String(id));
      const sessionStarted =
        responseBody.session_started === true &&
        String(refreshedSession?.status || '').toUpperCase() === 'OPEN';
      const deliveryFeedback = getAnnouncementDeliveryFeedback(responseBody);
      const responseDetails = formatBackendResponse(responseBody);
      setFeedback({
        type:
          sessionStarted &&
          deliveryFeedback?.type !== 'failed' &&
          responseBody.announcement_sent === true
            ? 'success'
            : 'warning',
        sessionMessage: sessionStarted
          ? typeof responseBody.message === 'string'
            ? responseBody.message
            : 'Order session started successfully.'
          : typeof responseBody.message === 'string'
          ? responseBody.message
          : 'The start request was accepted, but the refreshed status does not confirm that the session is open.',
        deliveryMessage:
          deliveryFeedback?.message ||
          'Telegram announcement delivery was not reported by the backend. Check the backend response and the group before retrying.',
        deliveryType: deliveryFeedback?.type,
        responseDetails,
      });
    } catch (err) {
      const requestMessage = getApiErrorMessage(err, 'Failed to start the order session.');
      const statusCode = err.response?.status;
      if (!err.response || statusCode >= 500) {
        const refreshedSessions = await fetchSessions({ silent: true });
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

      const deliveryFeedback = getAnnouncementDeliveryFeedback(err.response?.data);
      if (deliveryFeedback) {
        setFeedback({
          type: 'warning',
          sessionMessage: err.response?.data?.message || requestMessage,
          deliveryMessage: deliveryFeedback.message,
          deliveryType: deliveryFeedback.type,
          responseDetails: formatBackendResponse(err.response.data),
        });
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

      const refreshedSessions = await fetchSessions({ silent: true });
      const refreshedSession = refreshedSessions?.find((item) => String(item.id) === String(session.id));
      setFinalReport(getFinalReport(result) || getFinalReport(refreshedSession));
      const sessionClosed =
        result.success !== false &&
        (result.success === true ||
          String(result.status || '').toUpperCase() === 'CLOSED' ||
          String(refreshedSession?.status || '').toUpperCase() === 'CLOSED');
      setFeedback({
        type: sessionClosed ? 'success' : 'warning',
        sessionMessage: sessionClosed
          ? typeof result.message === 'string'
            ? result.message
            : 'Order session closed successfully.'
          : 'The close request was accepted, but the refreshed status does not confirm that the session is closed.',
        deliveryMessage:
          'Telegram report delivery is not inferred from HTTP success. Check the backend response for its delivery result.',
      });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to close the order session.'));
    } finally {
      setActionId(null);
    }
  };

  const handleSendGroupMessage = async (event) => {
    event.preventDefault();
    if (!messageSession || sendingGroupMessage) return;

    const trimmedMessage = groupMessage.trim();
    if (!trimmedMessage) {
      setGroupMessageError('Enter a message before sending.');
      return;
    }

    setSendingGroupMessage(true);
    setGroupMessageError('');
    try {
      const response = await api.post(
        `/admin/order-sessions/${messageSession.id}/messages`,
        { message: trimmedMessage }
      );
      const notifications = response.data?.telegram_notifications;
      if (
        response.data?.delivered !== true ||
        !Array.isArray(notifications) ||
        notifications.length === 0 ||
        notifications.some((notification) => notification.status !== 'sent')
      ) {
        throw new Error(
          response.data?.error ||
            response.data?.message ||
            'The backend did not confirm that Telegram delivered the message.'
        );
      }

      setFeedback({
        type: 'success',
        sessionMessage: `Message sent to the Telegram group for "${messageSession.title}".`,
      });
      setGroupMessage('');
      setMessageSession(null);
    } catch (err) {
      console.error('Failed to send Telegram group message', err);
      setGroupMessageError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          getApiErrorMessage(err, 'The message was not confirmed as delivered.')
      );
    } finally {
      setSendingGroupMessage(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <Badge tone="green">Open</Badge>;
      case 'CLOSED':
        return <Badge tone="red">Closed</Badge>;
      case 'EXPIRED':
        return <Badge tone="amber">Expired</Badge>;
      case 'DRAFT':
        return <Badge tone="gray">Draft</Badge>;
      default:
        return <Badge tone="gray">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <CoffeeLoader
        fullScreen={false}
        title="Brewing order sessions"
        message="Fetching active and scheduled ordering windows."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order sessions"
        description="Create ordering windows and manage session operations."
      >
        <Button
          variant="primary"
          icon="plus"
          onClick={() => {
            setFormError('');
            setShowModal(true);
          }}
          className="min-h-[40px]"
        >
          Create session
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
            onClick={() => fetchSessions()}
          >
            Retry
          </Button>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className={`flex items-start justify-between rounded-xl border p-4 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <Icon
              name={feedback.type === 'success' ? 'check' : 'filter'}
              size={18}
              className={`mt-0.5 shrink-0 ${
                feedback.type === 'success' ? 'text-emerald-600' : 'text-amber-600'
              }`}
            />
            <div>
              <p className="font-semibold">{feedback.sessionMessage}</p>
              {feedback.deliveryMessage && (
                <p
                  className={`mt-1 text-xs ${
                    feedback.deliveryType === 'failed' ? 'font-semibold text-rose-700' : 'opacity-90'
                  }`}
                >
                  {feedback.deliveryMessage}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss feedback"
            className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {feedback?.responseDetails && (
        <details className="rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-sm">
          <summary className="cursor-pointer font-semibold text-stone-800">
            Backend response details
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-stone-200 bg-stone-50 p-3 font-mono text-xs whitespace-pre-wrap break-words text-stone-700">
            {feedback.responseDetails}
          </pre>
        </details>
      )}

      {finalReport && (
        <Card title="Final order report returned by backend">
          <pre className="max-h-80 overflow-auto rounded-lg border border-stone-200 bg-stone-50 p-3 font-mono text-xs whitespace-pre-wrap break-words text-stone-700">
            {finalReport}
          </pre>
        </Card>
      )}

      {/* Metrics overview */}
      <section aria-label="Session overview" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total sessions"
          value={sessions.length}
          hint="All registered sessions"
          icon="clock"
          tone="blue"
        />
        <StatCard
          label="Open sessions"
          value={sessions.filter((s) => getSessionStatus(s, now) === 'OPEN').length}
          hint="Accepting customer orders"
          icon="trendUp"
          tone="green"
        />
        <StatCard
          label="Draft sessions"
          value={sessions.filter((s) => getSessionStatus(s, now) === 'DRAFT').length}
          hint="Ready to be started"
          icon="inbox"
          tone="amber"
        />
        <StatCard
          label="Completed"
          value={sessions.filter((s) => ['CLOSED', 'EXPIRED'].includes(getSessionStatus(s, now))).length}
          hint="Closed or expired"
          icon="receipt"
          tone="rose"
        />
      </section>

      {/* Sessions List */}
      <Card padded={false}>
        {!error && sessions.length === 0 ? (
          <EmptyState
            icon="clock"
            title="No order sessions"
            description="No ordering sessions have been created yet."
            action={
              <Button
                variant="primary"
                icon="plus"
                onClick={() => {
                  setFormError('');
                  setShowModal(true);
                }}
                className="min-h-[40px]"
              >
                Create session
              </Button>
            }
          />
        ) : (
          <>
            {/* Mobile Card Grid */}
            <div className="divide-y divide-stone-100 md:hidden">
              {sessions.map((session) => {
                const status = getSessionStatus(session, now);
                return (
                  <div key={session.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-stone-900">{session.title}</h3>
                        {session.order_number && (
                          <span className="mt-1 inline-block rounded bg-stone-100 px-2 py-0.5 font-mono text-xs font-semibold text-stone-700">
                            #{session.order_number}
                          </span>
                        )}
                      </div>
                      {getStatusBadge(status)}
                    </div>

                    <div className="space-y-1 rounded-xl bg-stone-50/70 p-3 text-xs text-stone-600">
                      <div>
                        Started:{' '}
                        <span className="font-medium text-stone-800">
                          {formatDateTime(session.started_at)}
                        </span>
                      </div>
                      <div>
                        Expires:{' '}
                        <span className="font-medium text-stone-800">
                          {formatDateTime(session.expires_at)}
                        </span>
                      </div>
                      {getSessionMetrics(session).map(([key, value]) => (
                        <div key={key}>
                          {key.replaceAll('_', ' ')}:{' '}
                          <span className="font-medium text-stone-800">{value}</span>
                        </div>
                      ))}
                      {getSessionDeliveryFields(session).map(([key, value]) => (
                        <div key={key}>
                          {key.replaceAll('_', ' ')}:{' '}
                          <span className="font-medium text-stone-800">{String(value)}</span>
                        </div>
                      ))}
                      {status === 'OPEN' && (
                        <div className="font-semibold text-emerald-700">
                          Remaining: {formatRemainingTime(session.expires_at, now)}
                        </div>
                      )}
                      {session.closed_at && (
                        <div>
                          Closed:{' '}
                          <span className="font-medium text-stone-800">
                            {formatDateTime(session.closed_at)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
                      <Button
                        variant="secondary"
                        icon="message"
                        onClick={() => {
                          setGroupMessage('');
                          setGroupMessageError('');
                          setMessageSession(session);
                        }}
                        disabled={actionId !== null || sendingGroupMessage}
                        className="min-h-[36px] text-xs"
                      >
                        Message group
                      </Button>

                      {status === 'DRAFT' && (
                        <Button
                          variant="accent"
                          onClick={() => handleStartSession(session.id)}
                          disabled={actionId !== null}
                          className="min-h-[36px] text-xs"
                        >
                          {actionId === session.id ? 'Starting…' : 'Start session'}
                        </Button>
                      )}
                      {status === 'OPEN' && (
                        <Button
                          variant="danger"
                          onClick={() => handleCloseSession(session)}
                          disabled={actionId !== null}
                          className="min-h-[36px] text-xs"
                        >
                          {actionId === session.id ? 'Ending…' : 'End session'}
                        </Button>
                      )}
                      {(status === 'CLOSED' || status === 'EXPIRED') && (
                        <span className="text-xs font-medium text-stone-400">Completed</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className={`hidden md:block ${tableWrap}`}>
              <table className={table}>
                <thead>
                  <tr>
                    <th className={th}>Session</th>
                    <th className={th}>Order number</th>
                    <th className={th}>Status</th>
                    <th className={th}>Schedule & metrics</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {sessions.map((session) => {
                    const status = getSessionStatus(session, now);
                    return (
                      <tr key={session.id} className={tr}>
                        <td className={td}>
                          <div className="font-bold text-stone-900">{session.title}</div>
                          <Button
                            variant="secondary"
                            icon="message"
                            onClick={() => {
                              setGroupMessage('');
                              setGroupMessageError('');
                              setMessageSession(session);
                            }}
                            disabled={actionId !== null || sendingGroupMessage}
                            className="mt-2 min-h-[32px] px-2.5 py-1 text-xs"
                          >
                            Message group
                          </Button>
                        </td>
                        <td className={td}>
                          {session.order_number ? (
                            <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs font-semibold text-stone-700">
                              #{session.order_number}
                            </span>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className={td}>{getStatusBadge(status)}</td>
                        <td className={`${td} space-y-1 text-xs text-stone-600`}>
                          <div>
                            Started:{' '}
                            <span className="font-medium text-stone-800">
                              {formatDateTime(session.started_at)}
                            </span>
                          </div>
                          <div>
                            Expires:{' '}
                            <span className="font-medium text-stone-800">
                              {formatDateTime(session.expires_at)}
                            </span>
                          </div>
                          {getSessionMetrics(session).map(([key, value]) => (
                            <div key={key}>
                              {key.replaceAll('_', ' ')}:{' '}
                              <span className="font-medium text-stone-800">{value}</span>
                            </div>
                          ))}
                          {getSessionDeliveryFields(session).map(([key, value]) => (
                            <div key={key}>
                              {key.replaceAll('_', ' ')}:{' '}
                              <span className="font-medium text-stone-800">{String(value)}</span>
                            </div>
                          ))}
                          {status === 'OPEN' && (
                            <div className="font-semibold text-emerald-700">
                              Remaining: {formatRemainingTime(session.expires_at, now)}
                            </div>
                          )}
                          {session.closed_at && (
                            <div>
                              Closed:{' '}
                              <span className="font-medium text-stone-800">
                                {formatDateTime(session.closed_at)}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className={`${td} space-x-2 text-right`}>
                          {status === 'DRAFT' && (
                            <Button
                              variant="accent"
                              onClick={() => handleStartSession(session.id)}
                              disabled={actionId !== null}
                              className="min-h-[36px] px-3 py-1.5 text-xs"
                            >
                              {actionId === session.id ? 'Starting…' : 'Start session'}
                            </Button>
                          )}
                          {status === 'OPEN' && (
                            <Button
                              variant="danger"
                              onClick={() => handleCloseSession(session)}
                              disabled={actionId !== null}
                              className="min-h-[36px] px-3 py-1.5 text-xs"
                            >
                              {actionId === session.id ? 'Ending…' : 'End session'}
                            </Button>
                          )}
                          {(status === 'CLOSED' || status === 'EXPIRED') && (
                            <span className="text-xs font-medium text-stone-400">Completed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Create Session Dialog / Bottom Sheet */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-stone-200 bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-900">Create order session</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close dialog"
                className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSession} className="mt-4 space-y-4">
              <div>
                <label htmlFor="session-title" className="block text-sm font-medium text-stone-700">
                  Session title
                </label>
                <input
                  id="session-title"
                  type="text"
                  required
                  maxLength={255}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Lunch order"
                  className={`${input} mt-1`}
                />
              </div>

              <div>
                <label
                  htmlFor="session-expiration"
                  className="block text-sm font-medium text-stone-700"
                >
                  Expiration date and time
                </label>
                <input
                  id="session-expiration"
                  type="datetime-local"
                  required
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  className={`${input} mt-1`}
                />
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <Button
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save session'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Telegram Group Message Dialog / Bottom Sheet */}
      {messageSession && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMessageSession(null);
              setGroupMessage('');
              setGroupMessageError('');
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-message-title"
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-stone-200 bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#ef5a3c]">
                  Telegram group
                </p>
                <h2 id="session-message-title" className="mt-1 text-lg font-bold text-stone-900">
                  Message group — {messageSession.title}
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  This message will be sent directly to the configured Telegram group.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMessageSession(null);
                  setGroupMessage('');
                  setGroupMessageError('');
                }}
                aria-label="Close dialog"
                className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {groupMessageError && (
              <div
                role="alert"
                className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
              >
                {groupMessageError}
              </div>
            )}

            <form onSubmit={handleSendGroupMessage} className="mt-4">
              <label
                htmlFor="session-group-message"
                className="block text-sm font-medium text-stone-700"
              >
                Message
              </label>
              <textarea
                id="session-group-message"
                required
                maxLength={MESSAGE_LIMIT}
                rows={5}
                value={groupMessage}
                onChange={(event) => setGroupMessage(event.target.value)}
                placeholder="Write your message…"
                className={`${input} mt-1 resize-y`}
              />
              <div className="mt-1 flex justify-between text-xs text-stone-400">
                <span>Markdown formatting supported by Telegram</span>
                <span>
                  {groupMessage.length}/{MESSAGE_LIMIT}
                </span>
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <Button
                  variant="secondary"
                  disabled={sendingGroupMessage}
                  onClick={() => {
                    setMessageSession(null);
                    setGroupMessage('');
                    setGroupMessageError('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={sendingGroupMessage || !groupMessage.trim()}
                >
                  {sendingGroupMessage ? 'Sending…' : 'Send message'}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
