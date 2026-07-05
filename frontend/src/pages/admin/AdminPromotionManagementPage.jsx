import { useEffect, useState } from 'react'
import promotionApi from '../../api/promotionApi'
import AdminPromotionFormModal from '../../components/promotion/AdminPromotionFormModal'
import './AdminPromotionManagementPage.css'

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

export default function AdminPromotionManagementPage() {
  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [togglingIds, setTogglingIds] = useState(new Set())
  const [deletingId, setDeletingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)

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
        <button className="adm-promo-create-btn" onClick={openCreate}>
          + Tạo khuyến mãi
        </button>
      </div>

      {error && (
        <div className="adm-promo-error">
          {error}
          <button className="adm-promo-error-dismiss" onClick={() => setError(null)}>✕</button>
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
              {promotions.map((promo) => (
                <tr key={promo.id} className={promo.isActive === false ? 'row-inactive' : ''}>
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
                    <span className={`adm-promo-status ${promo.isActive !== false ? 'active' : 'inactive'}`}>
                      {promo.isActive !== false ? 'Đang hoạt động' : 'Vô hiệu'}
                    </span>
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

      <AdminPromotionFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadPromotions}
        promotionId={editingId}
      />
    </div>
  )
}
