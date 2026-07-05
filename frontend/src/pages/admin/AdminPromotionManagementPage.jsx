import { useEffect, useMemo, useState } from 'react'
import promotionApi from '../../api/promotionApi'
import AdminPromotionFormModal from '../../components/promotion/AdminPromotionFormModal'
import PromotionUsageHistoryModal from '../../components/promotion/PromotionUsageHistoryModal'
import './AdminPromotionManagementPage.css'

// Module-level caches: persist across modal opens within the session
const promoCodeCache = new Map()    // promotionId (Number) -> code string
const customerInfoCache = new Map() // customerId (Number) -> { fullName, phone }

const isExpired = (promo) =>
  promo.endAt != null && new Date(promo.endAt) < new Date()

const sortByTimeDesc = (list) =>
  [...list].sort((a, b) => {
    const ta = a.usedAt ?? a.createdAt ?? a.appliedAt ?? a.timestamp ?? null
    const tb = b.usedAt ?? b.createdAt ?? b.appliedAt ?? b.timestamp ?? null
    if (!ta && !tb) return (b.id ?? 0) - (a.id ?? 0)
    if (!ta) return 1
    if (!tb) return -1
    return new Date(tb) - new Date(ta)
  })

const formatMoney = (value) => {
  if (value == null) return '—'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

const formatDiscount = (type, value) => {
  if (!type || value == null) return '—'
  const t = String(type).toUpperCase()
  if (t === 'PERCENTAGE' || t === 'PERCENT') return `${value}%`
  if (t === 'FIXED_AMOUNT' || t === 'FIXED') return formatMoney(value)
  return String(value)
}

const isPercent = (p) => {
  const t = String(p.discountType || '').toUpperCase()
  return t === 'PERCENT' || t === 'PERCENTAGE'
}
const isFixed = (p) => {
  const t = String(p.discountType || '').toUpperCase()
  return t === 'FIXED' || t === 'FIXED_AMOUNT'
}

export default function AdminPromotionManagementPage() {
  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [togglingIds, setTogglingIds] = useState(new Set())
  const [deletingId, setDeletingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)

  // ── Sort / Filter state ────────────────────────────────────
  const [sortField, setSortField] = useState('')       // '' | 'code' | 'startAt' | 'endAt'
  const [sortDir, setSortDir] = useState('desc')        // 'asc' | 'desc'
  const [typeFilter, setTypeFilter] = useState('ALL')   // 'ALL' | 'PERCENT' | 'FIXED'
  const [rangeMin, setRangeMin] = useState(0)
  const [rangeMax, setRangeMax] = useState(100)
  const [dateFilter, setDateFilter] = useState('')     // 'YYYY-MM-DD' | ''

  const [usageModal, setUsageModal] = useState({
    open: false,
    title: '',
    usages: [],
    loading: false,
    error: null,
  })

  // ── Send-voucher modal state ───────────────────────────────
  const [svTarget, setSvTarget] = useState(null)         // promo object
  const [svFilterType, setSvFilterType] = useState('ALL')
  const [svTier, setSvTier] = useState('')
  const [svMinVisits, setSvMinVisits] = useState('')
  const [svMinSpent, setSvMinSpent] = useState('')
  const [svSending, setSvSending] = useState(false)
  const [svResult, setSvResult] = useState(null)         // { success, message }

  const openUsageModal = async (title, fetchFn) => {
    setUsageModal({ open: true, title, usages: [], loading: true, error: null })
    try {
      const data = await fetchFn()
      const sorted = sortByTimeDesc(data)

      // Pre-populate promo code cache from already-loaded promotions
      for (const p of promotions) {
        if (p.id != null && p.code) promoCodeCache.set(Number(p.id), p.code)
      }

      // Fetch missing promo codes
      const missingPromoIds = [
        ...new Set(
          sorted
            .map((u) => u.promotionId)
            .filter((id) => id != null && !promoCodeCache.has(Number(id)))
        ),
      ]
      await Promise.allSettled(
        missingPromoIds.map(async (id) => {
          try {
            const detail = await promotionApi.getPromotionById(id)
            if (detail?.code) promoCodeCache.set(Number(id), detail.code)
          } catch {}
        })
      )

      // Fetch missing customer info
      const missingCustomerIds = [
        ...new Set(
          sorted
            .map((u) => u.customerId)
            .filter((id) => id != null && !customerInfoCache.has(Number(id)))
        ),
      ]
      await Promise.allSettled(
        missingCustomerIds.map(async (id) => {
          try {
            const user = await promotionApi.getUserById(id)
            customerInfoCache.set(Number(id), {
              fullName: user?.fullName ?? null,
              phone: user?.phone ?? null,
            })
          } catch {}
        })
      )

      const enriched = sorted.map((u) => ({
        ...u,
        promotionCode: promoCodeCache.get(Number(u.promotionId)) ?? null,
        customerFullName: customerInfoCache.get(Number(u.customerId))?.fullName ?? null,
        customerPhone: customerInfoCache.get(Number(u.customerId))?.phone ?? null,
      }))

      setUsageModal((prev) => ({ ...prev, usages: enriched, loading: false }))
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Không tải được lịch sử.'
      setUsageModal((prev) => ({ ...prev, loading: false, error: msg }))
    }
  }

  const closeUsageModal = () =>
    setUsageModal({ open: false, title: '', usages: [], loading: false, error: null })

  const loadPromotions = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await promotionApi.getActivePromotions()
      setPromotions(data)
    } catch {
      setError('Không tải được danh sách khuyến mãi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPromotions() }, [])

  const openCreate = () => { setEditingId(null); setModalOpen(true) }
  const openEdit = (id) => { setEditingId(id); setModalOpen(true) }

  const askDelete = (promo) => { setDeleteTarget(promo) }
  const cancelDelete = () => { setDeleteTarget(null) }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    setDeleteTarget(null)
    try {
      await promotionApi.deletePromotion(deleteTarget.id)
      setPromotions((prev) => prev.filter((p) => p.id !== deleteTarget.id))
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || ''
      setError(msg || 'Xóa khuyến mãi thất bại.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleStatus = async (promo) => {
    if (togglingIds.has(promo.id)) return
    const newActive = !promo.isActive

    setTogglingIds((prev) => new Set(prev).add(promo.id))
    try {
      const updated = await promotionApi.updatePromotionStatus(promo.id, newActive)
      setPromotions((prev) =>
        prev.map((p) =>
          p.id === promo.id ? { ...p, ...(updated || {}), isActive: newActive } : p
        )
      )
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || ''
      setError(msg || 'Cập nhật trạng thái thất bại.')
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(promo.id)
        return next
      })
    }
  }

  // ── Sort/filter logic (never mutates promotions array) ────
  const sliderAbsMax = useMemo(() => {
    if (typeFilter === 'PERCENT') {
      const vals = promotions.filter(isPercent).map(p => Number(p.discountValue)).filter(v => isFinite(v) && v > 0)
      return vals.length ? Math.ceil(Math.max(...vals)) : 100
    }
    if (typeFilter === 'FIXED') {
      return 100000
    }
    return 100
  }, [typeFilter, promotions])

  const filteredPromotions = useMemo(() => {
    let list = [...promotions]

    if (typeFilter === 'PERCENT') {
      list = list.filter(p => isPercent(p) && Number(p.discountValue) <= rangeMax)
    } else if (typeFilter === 'FIXED') {
      list = list.filter(p => isFixed(p) && Number(p.discountValue) <= rangeMax)
    }

    if (sortField === 'code') {
      list.sort((a, b) => {
        const cmp = String(a.code || '').localeCompare(String(b.code || ''), 'vi')
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else if (sortField === 'startAt' || sortField === 'endAt') {
      if (dateFilter) {
        list = list.filter((p) => {
          const val = p[sortField]
          if (!val) return false
          return new Date(val).toISOString().slice(0, 10) === dateFilter
        })
      }
      list.sort((a, b) => {
        const ta = a[sortField] ? new Date(a[sortField]) : null
        const tb = b[sortField] ? new Date(b[sortField]) : null
        if (!ta && !tb) return 0
        if (!ta) return 1
        if (!tb) return -1
        return sortDir === 'asc' ? ta - tb : tb - ta
      })
    }

    return list
  }, [promotions, typeFilter, rangeMin, rangeMax, sortField, sortDir, dateFilter])

  const handleTypeFilter = (type) => {
    setTypeFilter(type)
    setRangeMin(0)
    if (type === 'PERCENT') {
      const vals = promotions.filter(isPercent).map(p => Number(p.discountValue)).filter(v => isFinite(v) && v > 0)
      setRangeMax(vals.length ? Math.ceil(Math.max(...vals)) : 100)
    } else if (type === 'FIXED') {
      setRangeMax(100000)
    } else {
      setRangeMax(100)
    }
  }

  const openSendVoucher = (promo) => {
    const hasTiers = Array.isArray(promo.applicableTiers) && promo.applicableTiers.length > 0
    setSvTarget(promo)
    setSvFilterType(hasTiers ? 'TIER' : 'ALL')
    setSvTier(hasTiers ? promo.applicableTiers[0] : '')
    setSvMinVisits('')
    setSvMinSpent('')
    setSvSending(false)
    setSvResult(null)
  }

  const closeSendVoucher = () => { setSvTarget(null); setSvResult(null) }

  const confirmSendVoucher = async () => {
    if (!svTarget || svSending) return
    setSvSending(true)
    setSvResult(null)
    try {
      const result = await promotionApi.sendVoucher(svTarget.id, {
        filterType: svFilterType,
        tier: svFilterType === 'TIER' ? svTier : undefined,
        minVisits: svFilterType === 'MIN_VISITS' ? Number(svMinVisits) || undefined : undefined,
        minSpent: svFilterType === 'MIN_SPENT' ? Number(svMinSpent) || undefined : undefined,
      })
      setSvResult({ success: true, message: result?.message || 'Gửi thành công!' })
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Gửi thất bại.'
      setSvResult({ success: false, message: msg })
    } finally {
      setSvSending(false)
    }
  }

  const resetFilters = () => {
    setSortField('')
    setSortDir('desc')
    setTypeFilter('ALL')
    setRangeMin(0)
    setRangeMax(100)
    setDateFilter('')
  }

  const hasActiveFilters = sortField !== '' || typeFilter !== 'ALL' || dateFilter !== ''

  return (
    <div className="adm-promo-page">
      <div className="adm-promo-hero">
        <div className="adm-promo-hero-text">
          <p className="adm-promo-kicker">Quản trị viên</p>
          <h1>Quản lý khuyến mãi</h1>
          <span>
            Tạo, chỉnh sửa và bật/tắt các chương trình khuyến mãi.{' '}
            <em className="adm-promo-note">
              Danh sách chỉ hiển thị khuyến mãi đang active — reload để cập nhật sau khi vô hiệu hóa.
            </em>
          </span>
        </div>
        <div className="adm-promo-hero-actions">
          <button
            className="adm-promo-btn-all-usages"
            onClick={() => openUsageModal('Tất cả lượt dùng mã', promotionApi.getAllPromotionUsages.bind(promotionApi))}
          >
            Xem tất cả lượt dùng
          </button>
          <button className="adm-promo-create-btn" onClick={openCreate}>
            + Tạo khuyến mãi
          </button>
        </div>
      </div>

      {error && (
        <div className="adm-promo-error">
          {error}
          <button className="adm-promo-error-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {!loading && promotions.length > 0 && (
        <div className="adm-sf-bar">
          <div className="adm-sf-group">
            <span className="adm-sf-label">Sắp xếp</span>
            <div className="adm-sf-row">
              <select
                className="adm-sf-select"
                value={sortField}
                onChange={(e) => { setSortField(e.target.value); setDateFilter('') }}
              >
                <option value="">Mặc định</option>
                <option value="code">Mã A–Z</option>
                <option value="startAt">Ngày bắt đầu</option>
                <option value="endAt">Ngày kết thúc</option>
              </select>
              {sortField !== '' && (
                <button
                  className={`adm-sf-dir-btn ${sortDir}`}
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                >
                  {sortDir === 'asc' ? '↑ Tăng dần' : '↓ Giảm dần'}
                </button>
              )}
            </div>
          </div>

          {(sortField === 'startAt' || sortField === 'endAt') && (
            <div className="adm-sf-group">
              <span className="adm-sf-label">
                Lọc theo {sortField === 'startAt' ? 'ngày bắt đầu' : 'ngày kết thúc'}
              </span>
              <div className="adm-sf-row">
                <input
                  type="date"
                  className="adm-sf-date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
                {dateFilter && (
                  <button className="adm-sf-dir-btn" onClick={() => setDateFilter('')}>
                    ✕ Xóa
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="adm-sf-group">
            <span className="adm-sf-label">Loại giảm giá</span>
            <div className="adm-sf-row">
              {[
                { key: 'ALL', label: 'Tất cả' },
                { key: 'PERCENT', label: 'Phần trăm' },
                { key: 'FIXED', label: 'Số tiền' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={`adm-sf-type-btn${typeFilter === key ? ' active' : ''}`}
                  onClick={() => handleTypeFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {typeFilter !== 'ALL' && sliderAbsMax > 0 && (
            <div className="adm-sf-group">
              <span className="adm-sf-label">
                Giá trị tối đa:{' '}
                {typeFilter === 'PERCENT' ? `${rangeMax}%` : formatMoney(rangeMax)}
              </span>
              <div className="adm-sf-range-row">
                <span className="adm-sf-range-bound">0</span>
                <input
                  type="range"
                  className="adm-sf-range"
                  min={0}
                  max={sliderAbsMax}
                  value={rangeMax}
                  onChange={(e) => setRangeMax(Number(e.target.value))}
                />
                <span className="adm-sf-range-bound">
                  {typeFilter === 'PERCENT' ? `${sliderAbsMax}%` : formatMoney(sliderAbsMax)}
                </span>
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <button className="adm-sf-reset-btn" onClick={resetFilters}>
              Đặt lại
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="adm-promo-loading">Đang tải danh sách khuyến mãi...</div>
      ) : promotions.length === 0 ? (
        <div className="adm-promo-empty">
          <p>Chưa có khuyến mãi nào đang hoạt động.</p>
          <button className="adm-promo-create-btn" onClick={openCreate}>
            Tạo khuyến mãi đầu tiên
          </button>
        </div>
      ) : filteredPromotions.length === 0 ? (
        <div className="adm-promo-empty">
          <p>Không có khuyến mãi nào phù hợp với bộ lọc.</p>
          <button className="adm-sf-reset-btn" onClick={resetFilters}>Đặt lại bộ lọc</button>
        </div>
      ) : (
        <div className="adm-promo-table-wrapper">
          <table className="adm-promo-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
                <th>Loại / Giảm</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredPromotions.map((promo) => (
                <tr key={promo.id} className={`${promo.isActive === false ? 'row-inactive' : ''}${isExpired(promo) ? ' row-expired' : ''}`}>
                  <td>
                    <span className="adm-promo-code">{promo.code}</span>
                  </td>
                  <td>
                    <div className="adm-promo-name">{promo.name}</div>
                    {promo.description && (
                      <div className="adm-promo-desc">{promo.description}</div>
                    )}
                  </td>
                  <td>
                    <div className="adm-promo-type-label">
                      {promo.discountType === 'PERCENTAGE' || promo.discountType === 'PERCENT'
                        ? 'Phần trăm'
                        : 'Số tiền'}
                    </div>
                    <div className="adm-promo-value">
                      {formatDiscount(promo.discountType, promo.discountValue)}
                    </div>
                  </td>
                  <td>
                    {isExpired(promo) ? (
                      <span className="adm-promo-status expired">Hết hạn</span>
                    ) : (
                      <span className={`adm-promo-status ${promo.isActive !== false ? 'active' : 'inactive'}`}>
                        {promo.isActive !== false ? 'Đang hoạt động' : 'Vô hiệu'}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="adm-promo-row-actions">
                      <button
                        className="adm-promo-btn-edit"
                        onClick={() => openEdit(promo.id)}
                      >
                        Sửa
                      </button>
                      <button
                        className={`adm-promo-btn-toggle ${promo.isActive !== false ? 'on' : 'off'}`}
                        onClick={() => handleToggleStatus(promo)}
                        disabled={togglingIds.has(promo.id)}
                      >
                        {togglingIds.has(promo.id)
                          ? '...'
                          : promo.isActive !== false
                          ? 'Vô hiệu hóa'
                          : 'Kích hoạt'}
                      </button>
                      <button
                        className="adm-promo-btn-usages"
                        onClick={() =>
                          openUsageModal(
                            `Lượt dùng: ${promo.code}`,
                            () => promotionApi.getPromotionUsages(promo.id)
                          )
                        }
                      >
                        Xem lượt dùng
                      </button>
                      <button
                        className="adm-promo-btn-send"
                        onClick={() => openSendVoucher(promo)}
                      >
                        Gửi thông báo
                      </button>
                      <button
                        className="adm-promo-btn-delete"
                        onClick={() => askDelete(promo)}
                        disabled={deletingId === promo.id}
                      >
                        {deletingId === promo.id ? '...' : 'Xóa'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <div className="adm-promo-confirm-overlay">
          <div className="adm-promo-confirm-modal">
            <p>Xác nhận xóa khuyến mãi <strong>{deleteTarget.code}</strong>?</p>
            <p className="adm-promo-confirm-note">Chỉ xóa được nếu chưa có lịch sử sử dụng.</p>
            <div className="adm-promo-confirm-actions">
              <button className="adm-promo-confirm-btn-cancel" onClick={cancelDelete}>Hủy</button>
              <button className="adm-promo-confirm-btn-delete" onClick={confirmDelete}>Xóa</button>
            </div>
          </div>
        </div>
      )}

      {svTarget && (
        <div className="adm-promo-confirm-overlay">
          <div className="adm-sv-modal">
            <h3 className="adm-sv-title">Gửi voucher</h3>
            <p className="adm-sv-subtitle">
              Mã: <strong>{svTarget.code}</strong> — {svTarget.name}
            </p>

            <div className="adm-sv-group">
              <span className="adm-sv-label">Gửi đến:</span>
              <div className="adm-sv-types">
                {[
                  { key: 'ALL', label: 'Tất cả khách hàng' },
                  { key: 'TIER', label: 'Theo hạng thành viên' },
                  { key: 'MIN_VISITS', label: 'Theo số lần đến' },
                  { key: 'MIN_SPENT', label: 'Theo chi tiêu' },
                ].map(({ key, label }) => (
                  <label key={key} className="adm-sv-radio">
                    <input
                      type="radio"
                      name="svFilterType"
                      value={key}
                      checked={svFilterType === key}
                      onChange={() => setSvFilterType(key)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {svFilterType === 'TIER' && (
              <div className="adm-sv-group">
                <span className="adm-sv-label">Hạng:</span>
                <select
                  className="adm-sv-select"
                  value={svTier}
                  onChange={(e) => setSvTier(e.target.value)}
                >
                  {(Array.isArray(svTarget.applicableTiers) && svTarget.applicableTiers.length > 0
                    ? svTarget.applicableTiers
                    : ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']
                  ).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}

            {svFilterType === 'MIN_VISITS' && (
              <div className="adm-sv-group">
                <span className="adm-sv-label">Tối thiểu số lần đến:</span>
                <input
                  type="number"
                  className="adm-sv-input"
                  min={1}
                  placeholder="VD: 5"
                  value={svMinVisits}
                  onChange={(e) => setSvMinVisits(e.target.value)}
                />
              </div>
            )}

            {svFilterType === 'MIN_SPENT' && (
              <div className="adm-sv-group">
                <span className="adm-sv-label">Chi tiêu tối thiểu (VND):</span>
                <input
                  type="number"
                  className="adm-sv-input"
                  min={0}
                  placeholder="VD: 500000"
                  value={svMinSpent}
                  onChange={(e) => setSvMinSpent(e.target.value)}
                />
              </div>
            )}

            {svResult && (
              <div className={`adm-sv-result ${svResult.success ? 'success' : 'error'}`}>
                {svResult.message}
              </div>
            )}

            <div className="adm-promo-confirm-actions">
              <button className="adm-promo-confirm-btn-cancel" onClick={closeSendVoucher}>
                {svResult?.success ? 'Đóng' : 'Hủy'}
              </button>
              {!svResult?.success && (
                <button
                  className="adm-sv-confirm-btn"
                  onClick={confirmSendVoucher}
                  disabled={svSending || (svFilterType === 'TIER' && !svTier)}
                >
                  {svSending ? 'Đang gửi...' : 'Gửi'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <AdminPromotionFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadPromotions}
        promotionId={editingId}
      />

      <PromotionUsageHistoryModal
        open={usageModal.open}
        onClose={closeUsageModal}
        title={usageModal.title}
        usages={usageModal.usages}
        loading={usageModal.loading}
        error={usageModal.error}
        mode="admin"
      />
    </div>
  )
}
