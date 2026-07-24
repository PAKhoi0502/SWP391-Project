import { useEffect, useRef, useState } from 'react'
import { depositRefundApi } from '../../api/depositRefundApi'
import './AdminDepositRefundsPage.css'

const STATUS_OPTIONS = ['REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSING', 'REFUNDED', 'FAILED', 'CANCELED']
const PAGE_SIZE = 10

export default function AdminDepositRefundsPage() {
  const [refunds, setRefunds] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionRefund, setActionRefund] = useState(null)
  const [actionType, setActionType] = useState('')

  // Used to avoid loading flicker during silent background refreshes
  const silentRef    = useRef(false)
  const pollTimerRef = useRef(null)

  const reload = (silent = false) => {
    let ignore = false
    if (!silent) { setLoading(true); setError('') }

    depositRefundApi.getAdminDepositRefunds({ page, limit: PAGE_SIZE, status })
      .then((result) => {
        if (ignore) return
        setRefunds(Array.isArray(result?.data) ? result.data : [])
        setTotalPages(result?.totalPages || 1)
      })
      .catch((err) => {
        if (ignore || silent) return
        setRefunds([])
        setError(getErrorMessage(err, 'Unable to load deposit refunds.'))
      })
      .finally(() => { if (!ignore && !silent) setLoading(false) })

    return () => { ignore = true }
  }

  // Initial / filter-triggered load
  useEffect(() => reload(), [page, status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Silent background poll every 5 s; also re-fires on window focus / tab visibility regained
  useEffect(() => {
    let cancelled = false

    const poll = () => {
      if (cancelled) return
      silentRef.current = true
      depositRefundApi.getAdminDepositRefunds({ page, limit: PAGE_SIZE, status })
        .then((result) => {
          if (cancelled) return
          setRefunds(Array.isArray(result?.data) ? result.data : [])
          setTotalPages(result?.totalPages || 1)
        })
        .catch(() => { /* silently ignore poll errors */ })
        .finally(() => {
          silentRef.current = false
          if (!cancelled) pollTimerRef.current = setTimeout(poll, 5_000)
        })
    }

    const handleFocus = () => {
      if (cancelled) return
      clearTimeout(pollTimerRef.current)
      poll()
    }
    const handleVisibility = () => {
      if (!document.hidden) handleFocus()
    }

    pollTimerRef.current = setTimeout(poll, 5_000)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      cancelled = true
      clearTimeout(pollTimerRef.current)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [page, status]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async (refund) => {
    setActionRefund(refund)
    setActionType('approve')
    try {
      await depositRefundApi.approveDepositRefund(refund.id)
      setActionRefund(null)
      reload(false)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to approve refund.'))
      setActionRefund(null)
    }
  }

  return (
    <div className="adr-page">
      <section className="adr-hero">
        <h1>Deposit Refunds</h1>
        <p>Review, approve/reject, and execute customer deposit refund requests.</p>
      </section>

      <section className="adr-panel">
        <div className="adr-filters">
          <div className="adr-field">
            <span className="adr-label">Status</span>
            <select className="adr-select" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value) }}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{formatEnumLabel(s)}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="adr-error">{error}</div>}

        {loading ? (
          <div className="adr-state">Loading deposit refunds...</div>
        ) : refunds.length === 0 ? (
          <div className="adr-state">No deposit refund requests found</div>
        ) : (
          <>
            <div className="adr-table-wrap">
              <table className="adr-table">
                <thead>
                  <tr>
                    <th>Requested</th>
                    <th>Booking</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Bank account</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.requestedAt)}</td>
                      <td>#{r.bookingId}</td>
                      <td>#{r.customerId}</td>
                      <td>{formatMoney(r.requestedAmount)}</td>
                      <td>{r.bankName} · {r.accountNumber}<br /><span className="adr-muted">{r.accountHolderName}</span></td>
                      <td><span className={`adr-badge adr-badge--${String(r.status).toLowerCase()}`}>{formatEnumLabel(r.status)}</span></td>
                      <td className="adr-actions-cell">
                        {r.status === 'REQUESTED' && (
                          <>
                            <button type="button" className="adr-btn adr-btn--primary adr-btn--sm" onClick={() => handleApprove(r)} disabled={actionRefund?.id === r.id}>
                              Approve
                            </button>
                            <button type="button" className="adr-btn adr-btn--danger adr-btn--sm" onClick={() => { setActionRefund(r); setActionType('reject') }}>
                              Reject
                            </button>
                          </>
                        )}
                        {r.status === 'APPROVED' && (
                          <button type="button" className="adr-btn adr-btn--primary adr-btn--sm" onClick={() => { setActionRefund(r); setActionType('execute') }}>
                            Execute
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="adr-pagination">
                <button type="button" className="adr-page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  ← Previous
                </button>
                <span className="adr-page-info">Page {page} / {totalPages}</span>
                <button type="button" className="adr-page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {actionType === 'reject' && actionRefund && (
        <RejectDialog
          refund={actionRefund}
          onClose={() => { setActionRefund(null); setActionType('') }}
          onDone={() => { setActionRefund(null); setActionType(''); reload(false) }}
        />
      )}

      {actionType === 'execute' && actionRefund && (
        <ExecuteDialog
          refund={actionRefund}
          onClose={() => { setActionRefund(null); setActionType('') }}
          onDone={() => { setActionRefund(null); setActionType(''); reload(false) }}
        />
      )}
    </div>
  )
}

function RejectDialog({ refund, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Please enter a reason')
      return
    }
    setLoading(true)
    setError('')
    try {
      await depositRefundApi.rejectDepositRefund(refund.id, reason.trim())
      onDone()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reject refund.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="adr-overlay" onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}>
      <div className="adr-dialog" role="dialog" aria-modal="true">
        <h3>Reject refund #{refund.id}</h3>
        <label className="adr-dialog-label" htmlFor="reject-reason">Reason</label>
        <textarea
          id="reject-reason"
          className="adr-textarea"
          rows={3}
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError('') }}
          disabled={loading}
        />
        {error && <p className="adr-dialog-error">{error}</p>}
        <div className="adr-dialog-footer">
          <button type="button" className="adr-btn" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" className="adr-btn adr-btn--danger" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ExecuteDialog({ refund, onClose, onDone }) {
  const [success, setSuccess] = useState(true)
  const [note, setNote] = useState('')
  const [transactionReference, setTransactionReference] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (success && !transactionReference.trim()) {
      setError('Transaction reference is required after a successful transfer')
      return
    }
    setLoading(true)
    setError('')
    try {
      await depositRefundApi.executeDepositRefund(refund.id, { success, note: note.trim(), transactionReference: transactionReference.trim() })
      onDone()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to execute refund.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="adr-overlay" onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}>
      <div className="adr-dialog" role="dialog" aria-modal="true">
        <h3>Execute refund #{refund.id}</h3>
        <p className="adr-dialog-hint">Confirm after transferring {formatMoney(refund.requestedAmount)} to {refund.bankName} · {refund.accountNumber}.</p>

        <label className="adr-dialog-label">
          <input type="radio" checked={success} onChange={() => setSuccess(true)} disabled={loading} /> Transfer succeeded
        </label>
        <label className="adr-dialog-label">
          <input type="radio" checked={!success} onChange={() => setSuccess(false)} disabled={loading} /> Transfer failed
        </label>

        <label className="adr-dialog-label" htmlFor="tx-ref">Transaction reference</label>
        <input
          id="tx-ref"
          className="adr-input"
          value={transactionReference}
          onChange={(e) => setTransactionReference(e.target.value)}
          disabled={loading}
        />

        <label className="adr-dialog-label" htmlFor="exec-note">Note</label>
        <textarea
          id="exec-note"
          className="adr-textarea"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={loading}
        />

        {error && <p className="adr-dialog-error">{error}</p>}
        <div className="adr-dialog-footer">
          <button type="button" className="adr-btn" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" className="adr-btn adr-btn--primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0))
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatEnumLabel(value) {
  if (!value) return '-'
  return String(value).replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}

function getErrorMessage(err, fallback) {
  return err?.response?.data?.message || err?.response?.data || err?.message || fallback
}
