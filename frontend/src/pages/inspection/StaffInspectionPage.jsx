import { useState } from 'react'
import { vehicleInspectionApi } from '../../api/vehicleInspectionApi'
import '../booking/BookingHistoryPage.css'
import './StaffInspectionPage.css'

const blankForm = {
  inspectionType: 'BEFORE_WASH',
  exteriorCondition: '',
  interiorCondition: '',
  notes: '',
}

const typeLabels = {
  BEFORE_WASH: 'Trước khi rửa',
  AFTER_WASH: 'Sau khi rửa',
}

const formatDateTime = (value) => {
  if (!value) return 'Chưa cập nhật'
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
}

const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback

const formatNamedValue = (name, id, fallback = 'Không có') => (
  <span className="booking-named-value">
    <strong>{name || (id ? `#${id}` : fallback)}</strong>
  </span>
)

const toPayload = (form) => ({
  inspectionType: form.inspectionType,
  exteriorCondition: form.exteriorCondition.trim(),
  interiorCondition: form.interiorCondition.trim(),
  notes: form.notes.trim(),
})

function StaffInspectionPage() {
  const [bookingId, setBookingId] = useState('')
  const [searchedBookingId, setSearchedBookingId] = useState('')
  const [inspections, setInspections] = useState([])
  const [selectedInspection, setSelectedInspection] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadInspections = async (nextBookingId = searchedBookingId) => {
    if (!nextBookingId) return

    try {
      setLoading(true)
      setError('')
      setMessage('')
      const data = await vehicleInspectionApi.listByBooking(nextBookingId)
      setInspections(data)
      setSearchedBookingId(nextBookingId)

      if (selectedInspection && !data.some((item) => item.id === selectedInspection.id)) {
        setSelectedInspection(null)
      }
    } catch (err) {
      setInspections([])
      setSelectedInspection(null)
      setError(getErrorMessage(err, 'Không tải được danh sách kiểm tra xe.'))
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (event) => {
    event.preventDefault()
    const nextBookingId = bookingId.trim()

    if (!nextBookingId) {
      setError('Nhập mã booking để xem kiểm tra xe.')
      return
    }

    loadInspections(nextBookingId)
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    const targetBookingId = searchedBookingId || bookingId.trim()

    if (!targetBookingId) {
      setError('Nhập mã booking trước khi tạo inspection.')
      return
    }

    try {
      setSaving(true)
      setError('')
      const created = await vehicleInspectionApi.create(targetBookingId, toPayload(form))
      setMessage(`Đã tạo ${typeLabels[created.type] || 'inspection'} cho booking #${targetBookingId}.`)
      setForm(blankForm)
      setSelectedInspection(created)
      await loadInspections(targetBookingId)
    } catch (err) {
      setError(getErrorMessage(err, 'Không tạo được kiểm tra.'))
    } finally {
      setSaving(false)
    }
  }

  const handleSelect = async (inspectionId) => {
    try {
      setError('')
      setMessage('')
      const detail = await vehicleInspectionApi.getById(inspectionId)
      setSelectedInspection(detail)
      setForm({
        inspectionType: detail.type || 'BEFORE_WASH',
        exteriorCondition: detail.exteriorCondition || '',
        interiorCondition: detail.interiorCondition || '',
        notes: detail.notes || '',
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được chi tiết kiểm tra.'))
    }
  }

  const handleUpdate = async () => {
    if (!selectedInspection) return

    try {
      setSaving(true)
      setError('')
      const updated = await vehicleInspectionApi.update(selectedInspection.id, {
        exteriorCondition: form.exteriorCondition.trim(),
        interiorCondition: form.interiorCondition.trim(),
        notes: form.notes.trim(),
      })
      setSelectedInspection(updated)
      setMessage(`Đã cập nhật kiểm tra #${updated.id}.`)
      await loadInspections(updated.bookingId || searchedBookingId)
    } catch (err) {
      setError(getErrorMessage(err, 'Không cập nhật được kiểm tra.'))
    } finally {
      setSaving(false)
    }
  }

  const clearSelection = () => {
    setSelectedInspection(null)
    setForm(blankForm)
    setMessage('')
    setError('')
  }

  return (
    <div className="booking-history-page inspection-page">
      <section className="booking-history-hero inspection-hero">
        <div>
          <p>Staff</p>
          <h1>Kiểm tra xe</h1>
          <span>Tạo và cập nhật kiểm tra trước/sau rửa theo từng booking.</span>
        </div>
      </section>

      <form className="inspection-search" onSubmit={handleSearch}>
        <label>
          <span>Mã booking</span>
          <input
            value={bookingId}
            onChange={(event) => setBookingId(event.target.value)}
            inputMode="numeric"
            placeholder="Ví dụ: 58"
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Đang tải...' : 'Xem kiểm tra'}
        </button>
      </form>

      {message && <div className="inspection-message success">{message}</div>}
      {error && <div className="inspection-message error">{error}</div>}

      <section className="inspection-grid">
        <article className="inspection-panel">
          <div className="inspection-panel-head">
            <div>
              <p>Danh sách</p>
              <h2>{searchedBookingId ? `Booking #${searchedBookingId}` : 'Chọn booking'}</h2>
            </div>
            {searchedBookingId && (
              <button type="button" onClick={() => loadInspections(searchedBookingId)} disabled={loading}>
                Làm mới
              </button>
            )}
          </div>

          {loading ? (
            <div className="inspection-empty">Đang tải kiểm tra...</div>
          ) : inspections.length === 0 ? (
            <div className="inspection-empty">Chưa có kiểm tra cho booking này.</div>
          ) : (
            <div className="inspection-list">
              {inspections.map((inspection) => (
                <button
                  key={inspection.id}
                  type="button"
                  className={selectedInspection?.id === inspection.id ? 'active' : ''}
                  onClick={() => handleSelect(inspection.id)}
                >
                  <strong>{typeLabels[inspection.type] || inspection.type || 'Inspection'}</strong>
                  <span>#{inspection.id} - {formatDateTime(inspection.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="inspection-panel inspection-form-panel">
          <div className="inspection-panel-head">
            <div>
              <p>{selectedInspection ? 'Cập nhật' : 'Tạo mới'}</p>
              <h2>{selectedInspection ? `Kiểm tra #${selectedInspection.id}` : 'Kiểm tra'}</h2>
            </div>
            {selectedInspection && (
              <button type="button" onClick={clearSelection}>
                Tạo mới
              </button>
            )}
          </div>

          <form className="inspection-form" onSubmit={handleCreate}>
            <label>
              <span>Loại kiểm tra</span>
              <select name="inspectionType" value={form.inspectionType} onChange={handleChange} disabled={Boolean(selectedInspection)}>
                <option value="BEFORE_WASH">Trước khi rửa</option>
                <option value="AFTER_WASH">Sau khi rửa</option>
              </select>
            </label>

            <label>
              <span>Tình trạng ngoại thất</span>
              <textarea
                name="exteriorCondition"
                value={form.exteriorCondition}
                onChange={handleChange}
                placeholder="Ví dụ: trầy nhẹ cửa phải, kính trước sạch..."
              />
            </label>

            <label>
              <span>Tình trạng nội thất</span>
              <textarea
                name="interiorCondition"
                value={form.interiorCondition}
                onChange={handleChange}
                placeholder="Ví dụ: ghế sau có bụi, taplo cần vệ sinh..."
              />
            </label>

            <label>
              <span>Ghi chú</span>
              <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Ghi chú thêm cho kiểm tra" />
            </label>

            <div className="inspection-actions">
              {selectedInspection ? (
                <button type="button" onClick={handleUpdate} disabled={saving}>
                  {saving ? 'Đang cập nhật...' : 'Cập nhật inspection'}
                </button>
              ) : (
                <button type="submit" disabled={saving}>
                  {saving ? 'Đang tạo...' : 'Tạo kiểm tra'}
                </button>
              )}
            </div>
          </form>

          {selectedInspection && (
            <div className="inspection-detail">
              <h3>Chi tiết</h3>
              <dl>
                <div><dt>Booking</dt><dd>#{selectedInspection.bookingId}</dd></div>
                <div><dt>Xe</dt><dd>{formatNamedValue(selectedInspection.vehicleName, selectedInspection.vehicleId)}</dd></div>
                <div><dt>Garage</dt><dd>{formatNamedValue(selectedInspection.garageName, selectedInspection.garageId)}</dd></div>
                <div><dt>Nhân viên</dt><dd>{formatNamedValue(selectedInspection.inspectedByStaffName, selectedInspection.inspectedByStaffId)}</dd></div>
                <div><dt>Tạo lúc</dt><dd>{formatDateTime(selectedInspection.createdAt)}</dd></div>
                <div><dt>Cập nhật</dt><dd>{formatDateTime(selectedInspection.updatedAt)}</dd></div>
              </dl>
              {selectedInspection.images?.length > 0 && (
                <div className="inspection-image-list">
                  {selectedInspection.images.map((image) => (
                    <a key={image.id || image.imageUrl} href={image.imageUrl} target="_blank" rel="noreferrer">
                      Xem ảnh #{image.id || image.imageUrl}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </article>
      </section>
    </div>
  )
}

export default StaffInspectionPage
