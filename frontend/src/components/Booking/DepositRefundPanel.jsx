import { useEffect, useState } from 'react'
import { depositRefundApi } from '../../api/depositRefundApi'
import { bankAccountService } from '../../services/bankAccountService'
import './DepositRefundPanel.css'

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const STATUS_TEXT = {
  REQUESTED: 'Requested — awaiting review',
  APPROVED: 'Approved — pending transfer',
  REJECTED: 'Rejected',
  PROCESSING: 'Processing',
  REFUNDED: 'Refunded',
  FAILED: 'Failed — you can request again',
  CANCELED: 'Canceled',
}

const RETRYABLE_STATUSES = ['REJECTED', 'FAILED', 'CANCELED']

export default function DepositRefundPanel({ bookingId, refundAmount, onRefunded }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [eligibility, setEligibility] = useState(null)
  const [existingRefund, setExistingRefund] = useState(null)
  const [previousRefund, setPreviousRefund] = useState(null)
  const [bankAccounts, setBankAccounts] = useState([])
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      setExistingRefund(null)
      setPreviousRefund(null)
      try {
        const [eligibilityResult, myRefunds] = await Promise.all([
          depositRefundApi.getRefundEligibility(bookingId),
          depositRefundApi.getMyDepositRefunds(),
        ])
        if (cancelled) return

        setEligibility(eligibilityResult)
        const latest = (Array.isArray(myRefunds) ? myRefunds : [])
          .find((refund) => String(refund.bookingId) === String(bookingId))
        const latestStatus = String(latest?.status || '').toUpperCase()

        if (eligibilityResult?.eligible) {
          if (latest && RETRYABLE_STATUSES.includes(latestStatus)) {
            setPreviousRefund(latest)
          }
          const accounts = await bankAccountService.listOwn()
          if (cancelled) return
          setBankAccounts((Array.isArray(accounts) ? accounts : []).filter((account) => account.isActive))
        } else {
          setExistingRefund(latest || null)
        }
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || err?.message || 'Failed to load refund status')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [bookingId])

  const handleSubmit = async () => {
    if (!selectedBankAccountId) {
      setError('Please select a bank account')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const created = await depositRefundApi.createDepositRefund(bookingId, Number(selectedBankAccountId))
      setExistingRefund(created)
      setPreviousRefund(null)
      setEligibility({ eligible: false, reasonCode: 'ALREADY_REQUESTED' })
      onRefunded?.(created)
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to submit refund request')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="drp-panel"><p className="drp-loading">Checking refund eligibility...</p></div>
  }

  if (existingRefund) {
    const status = String(existingRefund.status || '').toUpperCase()
    return (
      <div className="drp-panel">
        <h3 className="drp-title">Deposit refund</h3>
        <p className="drp-status">
          <span className={`drp-badge drp-badge--${status.toLowerCase()}`}>{STATUS_TEXT[status] || status}</span>
        </p>
        <p className="drp-detail">
          {formatMoney(existingRefund.requestedAmount)} to {existingRefund.bankName} · {existingRefund.accountNumber}
        </p>
        {existingRefund.transactionReference && (
          <p className="drp-detail">Transfer reference: {existingRefund.transactionReference}</p>
        )}
        {status === 'REJECTED' && existingRefund.rejectReason && (
          <p className="drp-reject-reason">Reason: {existingRefund.rejectReason}</p>
        )}
      </div>
    )
  }

  if (!eligibility?.eligible) {
    return error ? <div className="drp-panel"><p className="drp-error">{error}</p></div> : null
  }

  return (
    <div className="drp-panel">
      <h3 className="drp-title">Request deposit refund</h3>
      <p className="drp-detail">You are eligible for a refund of <strong>{formatMoney(refundAmount)}</strong>.</p>
      {previousRefund && (
        <p className="drp-detail">
          Previous request: <strong>{STATUS_TEXT[String(previousRefund.status).toUpperCase()] || previousRefund.status}</strong>
          {previousRefund.rejectReason ? ` — ${previousRefund.rejectReason}` : ''}
        </p>
      )}

      {bankAccounts.length === 0 ? (
        <p className="drp-empty">Add a bank account in your profile to request this refund.</p>
      ) : (
        <>
          <div className="drp-accounts">
            {bankAccounts.map((account) => (
              <label key={account.id} className="drp-account-option">
                <input
                  type="radio"
                  name="drp-bank-account"
                  value={account.id}
                  checked={String(selectedBankAccountId) === String(account.id)}
                  onChange={(event) => setSelectedBankAccountId(event.target.value)}
                />
                <span>{account.bankName} · {account.accountNumber} · {account.accountHolderName}</span>
              </label>
            ))}
          </div>
          <button type="button" className="drp-submit-btn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Request refund'}
          </button>
        </>
      )}

      {error && <p className="drp-error">{error}</p>}
    </div>
  )
}
