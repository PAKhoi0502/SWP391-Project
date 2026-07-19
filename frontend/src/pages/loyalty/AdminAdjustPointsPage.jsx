import { useCallback, useEffect, useState } from 'react'
import loyaltyApi from '../../api/loyaltyApi'
import { userService } from '../../services/userService'
import './AdminAdjustPointsPage.css'

// ── Utils ────────────────────────────────────────────────────────────────────

const formatDate = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const toLocalDateTimeInput = (isoStr) => {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const getErrorMessage = (err, fallback = 'Something went wrong.') =>
  err?.response?.data?.message || err?.response?.data || err?.message || fallback

const STATUS_COLORS = {
  ACTIVE: 'pill--green', EXPIRING_SOON: 'pill--amber',
  EXPIRED: 'pill--red', CONSUMED: 'pill--gray',
}
const TX_COLORS = {
  EARN: 'pill--green', REDEEM: 'pill--amber', REFUND: 'pill--blue',
  EXPIRE: 'pill--red', ADJUST: 'pill--purple', ADMIN_ADJUST: 'pill--purple',
}

// ── Shared Customer Selector ─────────────────────────────────────────────────

function CustomerSelector({ selectedCustomerId, onSelect }) {
  const [inputId, setInputId] = useState(selectedCustomerId ? String(selectedCustomerId) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLookup = async () => {
    const id = inputId.trim()
    if (!id || Number.isNaN(Number(id))) { setError('Enter a valid numeric Customer ID.'); return }
    setError(''); setLoading(true)
    try {
      const customer = await userService.getUser(id)
      onSelect(customer)
    } catch (err) {
      setError(getErrorMessage(err, 'Customer not found.'))
      onSelect(null)
    } finally { setLoading(false) }
  }

  return (
    <div className="aap-selector">
      <div className="aap-lookup-row">
        <div className="aap-field">
          <span className="aap-label">Customer ID</span>
          <input className="aap-input" value={inputId}
            onChange={(e) => { setInputId(e.target.value); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            placeholder="Enter Customer ID" />
        </div>
        <button type="button" className="aap-btn aap-btn--primary"
          onClick={handleLookup} disabled={loading}>
          {loading ? 'Searching…' : 'Look up'}
        </button>
      </div>
      {error && <div className="aap-feedback aap-feedback--error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  )
}

// ── Customer Overview Card ────────────────────────────────────────────────────

function CustomerOverviewCard({ customer, loyalty, onRefresh, refreshing }) {
  if (!customer) return null

  const expiryWarning = loyalty?.nextExpiryAt && loyalty?.nextExpiringPoints > 0

  return (
    <div className="aap-overview-card">
      <div className="aap-overview-header">
        <div className="aap-overview-identity">
          <div className="aap-avatar-circle">
            {(customer.fullName || customer.email || 'C').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="aap-overview-name">{customer.fullName || '(no name)'}</div>
            <div className="aap-overview-meta">
              {customer.email || '—'} &nbsp;·&nbsp; ID #{customer.id}
              &nbsp;·&nbsp; {String(customer.role || '').replace('ROLE_', '')}
            </div>
          </div>
        </div>
        <button type="button" className="aap-btn aap-btn--ghost aap-btn--sm"
          onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {loyalty ? (
        <>
          <div className="aap-overview-stats">
            <div className="aap-stat">
              <div className="aap-stat-value">{loyalty.availablePoints ?? 0}</div>
              <div className="aap-stat-label">Available</div>
            </div>
            <div className="aap-stat">
              <div className="aap-stat-value">{loyalty.totalPoints ?? 0}</div>
              <div className="aap-stat-label">Total Earned</div>
            </div>
            <div className="aap-stat aap-stat--amber">
              <div className="aap-stat-value">{loyalty.redeemedPoints ?? 0}</div>
              <div className="aap-stat-label">Redeemed</div>
            </div>
            <div className="aap-stat aap-stat--red">
              <div className="aap-stat-value">{loyalty.expiredPoints ?? 0}</div>
              <div className="aap-stat-label">Expired</div>
            </div>
          </div>
          {expiryWarning && (
            <div className="aap-expiry-warning">
              ⚠ <strong>{loyalty.nextExpiringPoints} pts</strong> will expire on{' '}
              <strong>{formatDate(loyalty.nextExpiryAt)}</strong>
            </div>
          )}
          {loyalty.lastExpiryCheckAt && (
            <div className="aap-overview-footer">
              Last expiry check: {formatDate(loyalty.lastExpiryCheckAt)}
            </div>
          )}
        </>
      ) : (
        <p className="aap-empty" style={{ marginTop: 10 }}>No loyalty record found for this customer.</p>
      )}
    </div>
  )
}

// ── Tab: Adjust Points ────────────────────────────────────────────────────────

function AdjustTab({ customer, onCustomerRefresh }) {
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [submitError, setSubmitError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault(); setSuccess(''); setSubmitError('')
    const errs = {}
    if (!customer) errs.customer = 'Select a customer first using the search above.'
    const v = Number(points)
    if (!points || Number.isNaN(v) || !Number.isInteger(v) || v === 0)
      errs.points = 'Enter a non-zero whole number (negative to deduct).'
    if (!reason.trim()) errs.reason = 'Reason is required.'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSubmitting(true)
    try {
      await loyaltyApi.adjustPoints({ customerId: customer.id, points: v, reason: reason.trim() })
      setSuccess(`${v > 0 ? 'Added' : 'Deducted'} ${Math.abs(v)} pts ${v > 0 ? 'to' : 'from'} ${customer.fullName || customer.email}.`)
      setPoints(''); setReason('')
      onCustomerRefresh()
    } catch (err) { setSubmitError(getErrorMessage(err)) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="aap-tab-content">
      {!customer && (
        <div className="aap-feedback aap-feedback--info">Select a customer above to adjust points.</div>
      )}
      {customer && (
        <section className="aap-panel">
          <h2 className="aap-panel-title">Adjust points for {customer.fullName || customer.email}</h2>
          <form onSubmit={handleSubmit} className="aap-form">
            <div className="aap-field">
              <span className="aap-label">Points <span className="aap-hint">(negative to deduct)</span></span>
              <input className="aap-input" type="number" step="1" value={points}
                onChange={(e) => setPoints(e.target.value)} placeholder="e.g. 50 or -20" />
              {errors.points && <div className="aap-field-error">{errors.points}</div>}
            </div>
            <div className="aap-field">
              <span className="aap-label">Reason <span className="aap-required">*</span></span>
              <textarea className="aap-textarea" rows={3} value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Points compensation for booking issue" />
              {errors.reason && <div className="aap-field-error">{errors.reason}</div>}
            </div>
            {errors.customer && <div className="aap-feedback aap-feedback--error">{errors.customer}</div>}
            {submitError   && <div className="aap-feedback aap-feedback--error">{submitError}</div>}
            {success       && <div className="aap-feedback aap-feedback--success">{success}</div>}
            <button type="submit" className="aap-btn aap-btn--primary" disabled={submitting}>
              {submitting ? 'Processing…' : 'Apply adjustment'}
            </button>
          </form>
        </section>
      )}
    </div>
  )
}

// ── Extend Expiry Modal ───────────────────────────────────────────────────────

function ExtendExpiryModal({ lot, onClose, onSuccess }) {
  const [newDate, setNewDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('')
    if (!newDate) { setError('Select a new expiry date.'); return }
    if (!reason.trim()) { setError('Reason is required.'); return }
    setSubmitting(true)
    try {
      await loyaltyApi.extendLotExpiry({ lotId: lot.id, newExpiredAt: new Date(newDate).toISOString(), reason: reason.trim() })
      onSuccess()
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="aap-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="aap-modal">
        <div className="aap-modal-header">
          <h3>Extend Expiry — Lot #{lot.id}</h3>
          <button type="button" className="aap-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="aap-modal-body">
          <p className="aap-modal-meta">
            Current expiry: <strong>{formatDate(lot.expiredAt)}</strong><br/>
            Remaining pts: <strong>{lot.remainingPoints}</strong>
          </p>
          <form onSubmit={handleSubmit}>
            <div className="aap-field" style={{ marginBottom: 12 }}>
              <span className="aap-label">New expiry date <span className="aap-required">*</span></span>
              <input className="aap-input" type="datetime-local"
                min={toLocalDateTimeInput(new Date().toISOString())}
                value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="aap-field" style={{ marginBottom: 12 }}>
              <span className="aap-label">Reason <span className="aap-required">*</span></span>
              <textarea className="aap-textarea" rows={2} value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer retention exception" />
            </div>
            {error && <div className="aap-feedback aap-feedback--error" style={{ marginBottom: 10 }}>{error}</div>}
            <div className="aap-modal-actions">
              <button type="button" className="aap-btn aap-btn--ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="aap-btn aap-btn--primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Extend expiry'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Credit Lots ──────────────────────────────────────────────────────────

const CREDIT_STATUS_OPTIONS = ['ALL', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'CONSUMED']

function CreditLotsTab({ customer, onCustomerRefresh }) {
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [extending, setExtending] = useState(null)
  const [runningExpiry, setRunningExpiry] = useState(false)
  const [expiryResult, setExpiryResult] = useState(null)
  const [expiryError, setExpiryError] = useState('')

  const load = useCallback(async (p, sf) => {
    if (!customer) return
    setLoading(true); setError('')
    try {
      const res = await loyaltyApi.getAdminCustomerCreditLots({
        customerId: customer.id, page: p, limit: 20,
        status: sf !== 'ALL' ? sf : undefined,
      })
      setData(res)
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setLoading(false) }
  }, [customer])

  useEffect(() => {
    setData(null); setPage(1); setExpiryResult(null); setExpiryError('')
    if (customer) load(1, statusFilter)
  }, [customer]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChange = (sf) => {
    setStatusFilter(sf); setPage(1); load(1, sf)
  }

  const handleRunExpiry = async () => {
    if (!customer) return
    setRunningExpiry(true); setExpiryResult(null); setExpiryError('')
    try {
      const result = await loyaltyApi.runExpiryForCustomer(customer.id)
      setExpiryResult(result)
      onCustomerRefresh()
      load(page, statusFilter)
    } catch (err) { setExpiryError(getErrorMessage(err)) }
    finally { setRunningExpiry(false) }
  }

  const lots = Array.isArray(data?.content) ? data.content : []
  const totalPages = data?.totalPages ?? 0

  if (!customer) {
    return (
      <div className="aap-tab-content">
        <div className="aap-feedback aap-feedback--info">Select a customer above to view credit lots.</div>
      </div>
    )
  }

  return (
    <div className="aap-tab-content">
      <div className="aap-toolbar">
        <div className="aap-toolbar-actions">
          <button type="button" className="aap-btn aap-btn--ghost" onClick={() => load(page, statusFilter)} disabled={loading}>
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
          <button type="button" className="aap-btn aap-btn--primary" onClick={handleRunExpiry} disabled={runningExpiry}>
            {runningExpiry ? 'Running…' : 'Run expiry now'}
          </button>
        </div>
      </div>

      {expiryError && <div className="aap-feedback aap-feedback--error" style={{ marginTop: 8 }}>{expiryError}</div>}

      {expiryResult && (
        <div className={`aap-expiry-result ${expiryResult.changed ? 'aap-expiry-result--changed' : 'aap-expiry-result--nochange'}`}>
          <div className="aap-expiry-result-title">
            {expiryResult.changed ? '✓ Expiry completed' : 'No expired points found'}
          </div>
          {expiryResult.changed && (
            <div className="aap-expiry-result-grid">
              <div><span className="aap-run-label">Lots expired</span><strong>{expiryResult.lotsExpired}</strong></div>
              <div><span className="aap-run-label">Points expired</span><strong>{expiryResult.pointsExpired}</strong></div>
              <div><span className="aap-run-label">Available before</span><strong>{expiryResult.availablePointsBefore}</strong></div>
              <div><span className="aap-run-label">Available after</span><strong>{expiryResult.availablePointsAfter}</strong></div>
            </div>
          )}
          {expiryResult.nextExpiryAt && (
            <div className="aap-expiry-result-next">
              Next expiry: <strong>{expiryResult.nextExpiringPoints} pts</strong> on <strong>{formatDate(expiryResult.nextExpiryAt)}</strong>
            </div>
          )}
          <div className="aap-expiry-result-msg">{expiryResult.message}</div>
        </div>
      )}

      <div className="aap-filter-row">
        {CREDIT_STATUS_OPTIONS.map((s) => (
          <button key={s} type="button"
            className={`aap-filter-btn${statusFilter === s ? ' active' : ''}`}
            onClick={() => handleStatusChange(s)}>
            {s === 'ALL' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {error && <div className="aap-feedback aap-feedback--error">{error}</div>}

      {lots.length > 0 && (
        <>
          <div className="aap-table-wrap">
            <table className="aap-table">
              <thead>
                <tr>
                  <th>Lot ID</th>
                  <th>Type</th>
                  <th>Total</th>
                  <th>Remaining</th>
                  <th>Consumed</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => (
                  <tr key={lot.id}>
                    <td className="aap-td-mono">#{lot.id}</td>
                    <td><span className={`aap-pill ${TX_COLORS[lot.type] || 'pill--gray'}`}>{lot.type}</span></td>
                    <td>{lot.totalPoints}</td>
                    <td><strong>{lot.remainingPoints}</strong></td>
                    <td className="aap-td-muted">{lot.consumedPoints}</td>
                    <td><span className={`aap-pill ${STATUS_COLORS[lot.status] || 'pill--gray'}`}>{lot.status}</span></td>
                    <td className="aap-td-muted">{formatDate(lot.expiredAt)}</td>
                    <td className="aap-td-muted">{formatDate(lot.createdAt)}</td>
                    <td>
                      {lot.remainingPoints > 0 && lot.status !== 'EXPIRED' && lot.status !== 'CONSUMED' && (
                        <button type="button" className="aap-btn aap-btn--xs aap-btn--ghost"
                          onClick={() => setExtending(lot)}>
                          Extend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="aap-pagination">
              <button type="button" className="aap-btn aap-btn--ghost aap-btn--sm"
                disabled={page <= 1}
                onClick={() => { const p = page - 1; setPage(p); load(p, statusFilter) }}>
                ← Prev
              </button>
              <span className="aap-page-info">Page {page} / {totalPages}</span>
              <button type="button" className="aap-btn aap-btn--ghost aap-btn--sm"
                disabled={page >= totalPages}
                onClick={() => { const p = page + 1; setPage(p); load(p, statusFilter) }}>
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {!loading && data !== null && lots.length === 0 && (
        <p className="aap-empty">No credit lots found for this customer.</p>
      )}

      {extending && (
        <ExtendExpiryModal
          lot={extending}
          onClose={() => setExtending(null)}
          onSuccess={() => {
            setExtending(null)
            onCustomerRefresh()
            load(page, statusFilter)
          }}
        />
      )}
    </div>
  )
}

// ── Tab: Transaction History ──────────────────────────────────────────────────

const TX_TYPE_OPTIONS = ['', 'EARN', 'REDEEM', 'REFUND', 'EXPIRE', 'ADMIN_ADJUST']
const TX_TYPE_LABELS  = { '': 'All', EARN: 'Earned', REDEEM: 'Redeemed', REFUND: 'Refunded', EXPIRE: 'Expired', ADMIN_ADJUST: 'Admin Adj.' }

function TransactionsTab({ customer }) {
  const [typeFilter, setTypeFilter] = useState('')
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (p, tf) => {
    if (!customer) return
    setLoading(true); setError('')
    try {
      const res = await loyaltyApi.getAdminCustomerTransactions({
        customerId: customer.id, page: p, limit: 20,
        type: tf || undefined,
      })
      setData(res)
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setLoading(false) }
  }, [customer])

  useEffect(() => {
    setData(null); setPage(1)
    if (customer) load(1, typeFilter)
  }, [customer]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTypeChange = (tf) => {
    setTypeFilter(tf); setPage(1); load(1, tf)
  }

  const txs = Array.isArray(data?.content) ? data.content : []
  const totalPages = data?.totalPages ?? 0

  if (!customer) {
    return (
      <div className="aap-tab-content">
        <div className="aap-feedback aap-feedback--info">Select a customer above to view transactions.</div>
      </div>
    )
  }

  return (
    <div className="aap-tab-content">
      <div className="aap-toolbar">
        <div className="aap-toolbar-actions">
          <button type="button" className="aap-btn aap-btn--ghost" onClick={() => load(page, typeFilter)} disabled={loading}>
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <div className="aap-filter-row">
        {TX_TYPE_OPTIONS.map((t) => (
          <button key={t} type="button"
            className={`aap-filter-btn${typeFilter === t ? ' active' : ''}`}
            onClick={() => handleTypeChange(t)}>
            {TX_TYPE_LABELS[t] ?? t}
          </button>
        ))}
      </div>

      {error && <div className="aap-feedback aap-feedback--error">{error}</div>}

      {txs.length > 0 && (
        <>
          <div className="aap-table-wrap">
            <table className="aap-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Points</th>
                  <th>Source</th>
                  <th>Booking</th>
                  <th>Expires</th>
                  <th>Note</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((tx) => (
                  <tr key={tx.id}>
                    <td className="aap-td-mono">#{tx.id}</td>
                    <td><span className={`aap-pill ${TX_COLORS[tx.type] || 'pill--gray'}`}>{tx.type}</span></td>
                    <td className={tx.points < 0 ? 'aap-td-neg' : 'aap-td-pos'}>
                      {tx.points > 0 ? '+' : ''}{tx.points}
                    </td>
                    <td className="aap-td-muted">{tx.source || '—'}</td>
                    <td className="aap-td-muted">{tx.bookingId ? `#${tx.bookingId}` : '—'}</td>
                    <td className="aap-td-muted">{tx.type === 'EARN' ? formatDate(tx.expiredAt) : '—'}</td>
                    <td className="aap-td-note">{tx.note || '—'}</td>
                    <td className="aap-td-muted">{formatDate(tx.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="aap-pagination">
              <button type="button" className="aap-btn aap-btn--ghost aap-btn--sm"
                disabled={page <= 1}
                onClick={() => { const p = page - 1; setPage(p); load(p, typeFilter) }}>
                ← Prev
              </button>
              <span className="aap-page-info">Page {page} / {totalPages}</span>
              <button type="button" className="aap-btn aap-btn--ghost aap-btn--sm"
                disabled={page >= totalPages}
                onClick={() => { const p = page + 1; setPage(p); load(p, typeFilter) }}>
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {!loading && data !== null && txs.length === 0 && (
        <p className="aap-empty">No transactions found.</p>
      )}
    </div>
  )
}

// ── Tab: Scheduler ────────────────────────────────────────────────────────────

const SCHED_STATUS = {
  RUNNING:         { label: 'Running',         cls: 'pill--amber' },
  SUCCESS:         { label: 'Success',          cls: 'pill--green' },
  PARTIAL_FAILURE: { label: 'Partial Failure',  cls: 'pill--amber' },
  FAILURE:         { label: 'Failed',           cls: 'pill--red'   },
}

function SchedulerTab() {
  const [runStatus, setRunStatus] = useState(undefined)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const loadStatus = async () => {
    setLoading(true); setLoadError('')
    try { setRunStatus(await loyaltyApi.getLatestExpiryRun()) }
    catch (err) { setLoadError(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadStatus() }, [])

  const sd = runStatus ? (SCHED_STATUS[runStatus.status] ?? { label: runStatus.status, cls: 'pill--gray' }) : null

  return (
    <div className="aap-tab-content">
      <section className="aap-panel">
        <div className="aap-panel-title-row">
          <h2 className="aap-panel-title">Daily Expiry Scheduler — Last Run</h2>
          <button type="button" className="aap-btn aap-btn--ghost aap-btn--sm" onClick={loadStatus} disabled={loading}>
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>
        <p className="aap-panel-desc">
          The scheduler runs automatically every night at 02:15 Asia/Ho_Chi_Minh to expire overdue credit lots across all customers.
        </p>
        {loadError && <div className="aap-feedback aap-feedback--error">{loadError}</div>}
        {!loading && runStatus === null && !loadError && (
          <div className="aap-run-never">
            <div className="aap-run-never-icon">🕐</div>
            <div className="aap-run-never-title">No scheduled run recorded yet</div>
            <div className="aap-run-never-desc">
              The scheduler has not run since deployment. It will run automatically tonight at 02:15 or can be triggered manually from the server.
            </div>
          </div>
        )}
        {runStatus && sd && (
          <div className="aap-run-info">
            <div className="aap-run-row">
              <span className="aap-run-label">Status</span>
              <span className={`aap-pill ${sd.cls}`}>{sd.label}</span>
            </div>
            <div className="aap-run-row">
              <span className="aap-run-label">Run ID</span>
              <span className="aap-td-mono">#{runStatus.logId}</span>
            </div>
            <div className="aap-run-row">
              <span className="aap-run-label">Started</span>
              <span>{formatDate(runStatus.startedAt)}</span>
            </div>
            <div className="aap-run-row">
              <span className="aap-run-label">Finished</span>
              <span>{runStatus.finishedAt ? formatDate(runStatus.finishedAt) : 'Still running…'}</span>
            </div>
            <div className="aap-run-row">
              <span className="aap-run-label">Customers processed</span>
              <span>{runStatus.customersProcessed ?? 0}</span>
            </div>
            <div className="aap-run-row">
              <span className="aap-run-label">Succeeded / Failed</span>
              <span>
                <span className="aap-td-pos">{runStatus.customersSucceeded ?? 0}</span>
                {' / '}
                <span className={runStatus.customersFailed > 0 ? 'aap-td-neg' : ''}>{runStatus.customersFailed ?? 0}</span>
              </span>
            </div>
            <div className="aap-run-row">
              <span className="aap-run-label">Lots expired</span>
              <span>{runStatus.lotsExpired ?? 0}</span>
            </div>
            <div className="aap-run-row">
              <span className="aap-run-label">Points expired</span>
              <span>{runStatus.pointsExpired ?? 0}</span>
            </div>
            {runStatus.errorSummary && (
              <div className="aap-run-row">
                <span className="aap-run-label">Error summary</span>
                <span className="aap-td-neg aap-run-error">{runStatus.errorSummary}</span>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Page Root ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'adjust',       label: 'Adjust Points' },
  { id: 'credit-lots',  label: 'Credit Lots' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'scheduler',    label: 'Scheduler' },
]

export default function AdminAdjustPointsPage() {
  const [activeTab, setActiveTab] = useState('adjust')
  const [customer, setCustomer] = useState(null)
  const [loyalty, setLoyalty] = useState(null)
  const [loyaltyLoading, setLoyaltyLoading] = useState(false)

  const loadLoyalty = useCallback(async (cust) => {
    if (!cust) { setLoyalty(null); return }
    setLoyaltyLoading(true)
    try {
      const data = await loyaltyApi.getAdminCustomerOverview(cust.id)
      setLoyalty(data)
    } catch {
      setLoyalty(null)
    } finally { setLoyaltyLoading(false) }
  }, [])

  const handleCustomerSelect = (cust) => {
    setCustomer(cust)
    loadLoyalty(cust)
  }

  const handleCustomerRefresh = useCallback(() => {
    loadLoyalty(customer)
  }, [customer, loadLoyalty])

  return (
    <div className="aap-page">
      <section className="aap-hero">
        <h1>Loyalty Management</h1>
        <p>Adjust points, inspect credit lots, review transaction history, and manage point expiry.</p>
      </section>

      <div className="aap-customer-section">
        <CustomerSelector selectedCustomerId={customer?.id} onSelect={handleCustomerSelect} />
        <CustomerOverviewCard
          customer={customer}
          loyalty={loyalty}
          onRefresh={handleCustomerRefresh}
          refreshing={loyaltyLoading}
        />
      </div>

      <div className="aap-tabs-bar">
        {TABS.map((t) => (
          <button key={t.id} type="button"
            className={`aap-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'adjust'       && <AdjustTab customer={customer} onCustomerRefresh={handleCustomerRefresh} />}
      {activeTab === 'credit-lots'  && <CreditLotsTab customer={customer} onCustomerRefresh={handleCustomerRefresh} />}
      {activeTab === 'transactions' && <TransactionsTab customer={customer} />}
      {activeTab === 'scheduler'    && <SchedulerTab />}
    </div>
  )
}
