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

export default function DepositRefundPanel({ bookingId, refundAmount, onRefunded }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [eligibility, setEligibility] = useState(null)
  const [existingRefund, setExistingRefund] = useState(null)
  const [bankAccounts, setBankAccounts] = useState([])
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const eligibilityResult = await depositRefundApi.getRefundEligibility(bookingId)
        if (cancelled) return
        setEligibility(eligibilityResult)

        if (eligibilityResult?.eligible) {
          const accounts = await bankAccountService.listOwn()
          if (cancelled) return
          setBankAccounts((Array.isArray(accounts) ? accounts : []).filter((a) => a.isActive))
        } else if (eligibilityResult?.reasonCode === 'ALREADY_REQUESTED') {
          const myRefunds = await depositRefundApi.getMyDepositRefunds()
          if (cancelled) return
          const mine = (Array.isArray(myRefunds) ? myRefunds : [])
            .find((r) => String(r.bookingId) === String(bookingId))
          setExistingRefund(mine || null)
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
        {status === 'REJECTED' && existingRefund.rejectReason && (
          <p className="drp-reject-reason">Reason: {existingRefund.rejectReason}</p>
        )}
      </div>
    )
  }

  if (!eligibility?.eligible) {
    return null
  }

  return (
    <div className="drp-panel">
      <h3 className="drp-title">Request deposit refund</h3>
      <p className="drp-detail">You are eligible for a refund of <strong>{formatMoney(refundAmount)}</strong>.</p>

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
                  onChange={(e) => setSelectedBankAccountId(e.target.value)}
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
