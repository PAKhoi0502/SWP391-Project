import { useCallback, useEffect, useRef, useState } from 'react'
import loyaltyApi from '../../api/loyaltyApi'
import AdminPromotionFormModal from '../../components/promotion/AdminPromotionFormModal'
import './AdminTopCustomersPage.css'

const TIER_OPTIONS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']
const TIER_LABELS = { BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold', PLATINUM: 'Platinum' }

const getErrorMessage = (err, fallback = 'Something went wrong.') =>
  err?.response?.data?.message || err?.response?.data || err?.message || fallback

const formatCurrency = (v) => {
  if (v == null) return '—'
  return Number(v).toLocaleString('vi-VN') + '₫'
}

function CustomerAvatar({ avatarUrl, label }) {
  const [imgError, setImgError] = useState(false)
  if (avatarUrl && !imgError) {
    return (
      <img
        className="atc-avatar-img"
        src={avatarUrl}
        alt={label}
        onError={() => setImgError(true)}
      />
    )
  }
  return <div className="atc-avatar-circle">{(label || 'C').charAt(0).toUpperCase()}</div>
}

export default function AdminTopCustomersPage() {
  const [plateInput, setPlateInput] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [promoTarget, setPromoTarget] = useState(null)

  const debounceRef = useRef(null)

  const load = useCallback(async (p, tier, licensePlate) => {
    setLoading(true)
    setError('')
    try {
      const res = await loyaltyApi.getTopCustomers({
        tier: tier || undefined,
        licensePlate: licensePlate || undefined,
        page: p,
        limit: 20,
      })
      setData(res)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load top customers.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      load(1, tierFilter, plateInput.trim())
    }, 280)
    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plateInput, tierFilter])

  const handlePageChange = (p) => {
    setPage(p)
    load(p, tierFilter, plateInput.trim())
  }

  const customers = Array.isArray(data?.content) ? data.content : []
  const totalPages = data?.totalPages ?? 0

  return (
    <div className="atc-page">
      <section className="atc-hero">
        <h1>Top Customers</h1>
        <p>Customers with the highest loyalty rank and the most bookings. Filter by license plate to find a customer quickly and grant them a private promotion.</p>
      </section>

      <div className="atc-panel">
        <div className="atc-filter-row">
          <div className="atc-field">
            <span className="atc-label">License plate</span>
            <input
              className="atc-input"
              value={plateInput}
              onChange={(e) => setPlateInput(e.target.value)}
              placeholder="e.g. 30A12345"
            />
          </div>
          <div className="atc-field">
            <span className="atc-label">Tier</span>
            <select
              className="atc-input"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
            >
              <option value="">All tiers</option>
              {TIER_OPTIONS.map((t) => (
                <option key={t} value={t}>{TIER_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="atc-btn atc-btn--ghost"
            onClick={() => load(page, tierFilter, plateInput.trim())}
            disabled={loading}
          >
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>

        {error && <div className="atc-feedback atc-feedback--error">{error}</div>}

        {customers.length > 0 && (
          <>
            <div className="atc-table-wrap">
              <table className="atc-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Tier</th>
                    <th>Bookings</th>
                    <th>Points</th>
                    <th>Total spent</th>
                    <th>License plates</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.customerId}>
                      <td>
                        <div className="atc-customer-cell">
                          <CustomerAvatar avatarUrl={c.avatarUrl} label={c.fullName || c.email} />
                          <div>
                            <div className="atc-customer-name">{c.fullName || '(no name)'}</div>
                            <div className="atc-customer-meta">{c.email || c.phone || `#${c.customerId}`}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`atc-tier atc-tier--${(c.currentTier || 'bronze').toLowerCase()}`}>
                          {TIER_LABELS[c.currentTier] || c.currentTier || '—'}
                        </span>
                      </td>
                      <td className="atc-td-strong">{c.totalVisits ?? 0}</td>
                      <td>{c.totalPoints ?? 0}</td>
                      <td className="atc-td-muted">{formatCurrency(c.totalSpent)}</td>
                      <td className="atc-td-muted">
                        {Array.isArray(c.licensePlates) && c.licensePlates.length > 0
                          ? c.licensePlates.join(', ')
                          : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="atc-btn atc-btn--primary atc-btn--sm"
                          onClick={() => setPromoTarget(c)}
                        >
                          Create promotion
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="atc-pagination">
                <button
                  type="button"
                  className="atc-btn atc-btn--ghost atc-btn--sm"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  ← Prev
                </button>
                <span className="atc-page-info">Page {page} / {totalPages}</span>
                <button
                  type="button"
                  className="atc-btn atc-btn--ghost atc-btn--sm"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {!loading && data !== null && customers.length === 0 && (
          <p className="atc-empty">No customers found for this filter.</p>
        )}
      </div>

      {promoTarget && (
        <AdminPromotionFormModal
          isOpen={!!promoTarget}
          onClose={() => setPromoTarget(null)}
          onSuccess={() => setPromoTarget(null)}
          presetTarget={{
            customerId: promoTarget.customerId,
            label: promoTarget.fullName || promoTarget.email || `Customer #${promoTarget.customerId}`,
          }}
        />
      )}
    </div>
  )
}
