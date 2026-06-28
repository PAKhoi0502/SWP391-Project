import { useEffect, useMemo, useState } from 'react'
import {
  PACKAGE_TYPES,
  VEHICLE_TYPES,
  createServicePackage,
  extractList,
  getErrorMessage,
  getPackageActive,
  getPackageDuration,
  getPackageId,
  getPackageName,
  getPackagePrice,
  getPackageType,
  getServicePackages,
  updateServicePackage,
  updateServicePackageStatus,
} from '../../services/servicePackageApi'
import '../ServicePackagePage.css'

const initialForm = {
  name: '',
  description: '',
  vehicleType: 'CAR',
  packageType: 'MAIN',
  price: '',
  durationMinutes: '',
  includedServiceIds: '',
  stepsTemplate: '',
  requiresWashBay: true,
  requiresCareStaff: false,
  careStaffDurationMinutes: '0',
  careStaffRequiredCount: '0',
  careStaffType: 'NONE',
  pointsEarned: '0',
}

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
})

export default function AdminServicePackagePage() {
  const [packages, setPackages] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [vehicleFilter, setVehicleFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const filteredPackages = useMemo(() => {
    return packages.filter((item) => {
      const name = getPackageName(item).toLowerCase()
      const matchKeyword = name.includes(keyword.trim().toLowerCase())
      const matchType = typeFilter === 'ALL' || getPackageType(item) === typeFilter
      const matchVehicle = vehicleFilter === 'ALL' || item.vehicleType === vehicleFilter

      return matchKeyword && matchType && matchVehicle
    })
  }, [packages, keyword, typeFilter, vehicleFilter])

  useEffect(() => {
    loadPackages()
  }, [])

  async function loadPackages() {
    try {
      setLoading(true)
      setError('')
      const data = await getServicePackages()
      setPackages(extractList(data))
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách gói dịch vụ'))
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function buildPayload() {
    const serviceIds = form.includedServiceIds
      .split(',')
      .map((id) => Number(id.trim()))
      .filter(Boolean)

    const steps = form.stepsTemplate
      .split('\n')
      .map((line, index) => line.trim())
      .filter(Boolean)
      .map((line, index) => ({
  stepOrder: index + 1,
  name: line,
  description: line,
  isRequired: true,
  instructions: [],
}))
    const cleanName = form.name.trim()
const code = cleanName
  .toUpperCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')

return {
  name: cleanName,
  packageName: cleanName,
  code: code || `PACKAGE_${Date.now()}`,

  description: form.description.trim(),

  vehicleType: form.vehicleType,

  serviceType: form.packageType,
packageType: form.packageType,
type: form.packageType,

  price: Number(form.price),
  basePrice: Number(form.price),

  durationMinutes: Number(form.durationMinutes),
estimatedDurationMinutes: Number(form.durationMinutes),
washBayDurationMinutes: Number(form.durationMinutes),

  requiresWashBay: true,
  requiresCareStaff: false,

  careStaffDurationMinutes: 0,
  careStaffRequiredCount: 0,
  careStaffType: 'NONE',

  pointsEarned: 0,

  includedServiceIds: serviceIds,
  serviceIds,

  stepsTemplate: steps,
  steps,

  isActive: true,
  active: true,
}
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.name.trim()) return alert('Vui lòng nhập tên gói dịch vụ')
    if (!form.price || Number(form.price) < 0) return alert('Vui lòng nhập giá hợp lệ')
    if (!form.durationMinutes || Number(form.durationMinutes) <= 0) return alert('Vui lòng nhập thời lượng hợp lệ')

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const payload = buildPayload()

      if (editingId) {
        await updateServicePackage(editingId, payload)
        setSuccess('Cập nhật gói dịch vụ thành công')
      } else {
        await createServicePackage(payload)
        setSuccess('Tạo gói dịch vụ thành công')
      }

      setForm(initialForm)
      setEditingId(null)
      await loadPackages()
    } catch (err) {
      setError(getErrorMessage(err, 'Lưu gói dịch vụ thất bại'))
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(item) {
    const includedServices = item.includedServiceIds || item.serviceIds || item.includedServices || item.services || []
    const steps = item.stepsTemplate || item.steps || []

    setEditingId(getPackageId(item))
    setForm({
  name: getPackageName(item),
  description: item.description || '',
  vehicleType: item.vehicleType || 'CAR',
  packageType: getPackageType(item) || 'MAIN',
  price: String(getPackagePrice(item) || ''),
  durationMinutes: String(getPackageDuration(item) || ''),
  includedServiceIds: Array.isArray(includedServices)
    ? includedServices
        .map((service) => service.id || service.serviceId || service)
        .filter(Boolean)
        .join(', ')
    : '',
  stepsTemplate: Array.isArray(steps)
    ? steps
        .map((step) => step.title || step.name || step.description || step)
        .join('\n')
    : '',
  requiresWashBay: item.requiresWashBay ?? true,
  requiresCareStaff: item.requiresCareStaff ?? false,
  careStaffDurationMinutes: String(item.careStaffDurationMinutes ?? 0),
  careStaffRequiredCount: String(item.careStaffRequiredCount ?? 0),
  careStaffType: item.careStaffType || 'NONE',
  pointsEarned: String(item.pointsEarned ?? 0),
})

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelEdit() {
    setEditingId(null)
    setForm(initialForm)
    setError('')
    setSuccess('')
  }

  async function handleToggleStatus(item) {
    const id = getPackageId(item)
    const nextActive = !getPackageActive(item)

    const ok = window.confirm(
      nextActive ? 'Bạn muốn kích hoạt gói này?' : 'Bạn muốn tạm ngưng gói này?'
    )

    if (!ok) return

    try {
      setError('')
      setSuccess('')
      await updateServicePackageStatus(id, nextActive)
      setSuccess(nextActive ? 'Đã kích hoạt gói dịch vụ' : 'Đã tạm ngưng gói dịch vụ')
      await loadPackages()
    } catch (err) {
      setError(getErrorMessage(err, 'Cập nhật trạng thái thất bại'))
    }
  }

  return (
    <div className="service-package-page">
      <section className="service-package-hero">
        <div>
          <p className="service-package-kicker">Admin</p>
          <h1>Quản lý gói dịch vụ</h1>
          <p>
            Tạo, cập nhật, bật/tắt gói dịch vụ và quản lý MAIN / ADD_ON / COMBO.
          </p>
        </div>

        <div className="service-package-stats">
          <div className="service-package-stat">
            <span>Tổng gói</span>
            <strong>{packages.length}</strong>
          </div>
          <div className="service-package-stat">
            <span>Active</span>
            <strong>{packages.filter((item) => getPackageActive(item)).length}</strong>
          </div>
          <div className="service-package-stat">
            <span>Combo</span>
            <strong>{packages.filter((item) => getPackageType(item) === 'COMBO').length}</strong>
          </div>
        </div>
      </section>

      {error && <div className="service-package-alert error">{error}</div>}
      {success && <div className="service-package-alert success">{success}</div>}

      <section className="service-package-panel">
        <div className="service-package-panel-header">
          <div>
            <h2>{editingId ? 'Cập nhật gói dịch vụ' : 'Tạo gói dịch vụ mới'}</h2>
            <p>Nhập thông tin package, included services và steps template.</p>
          </div>

          {editingId && (
            <button className="service-package-ghost-btn" type="button" onClick={handleCancelEdit}>
              Hủy sửa
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="service-package-form-grid">
            <input
              className="service-package-input"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Tên gói dịch vụ"
            />

            <input
              className="service-package-input"
              name="price"
              value={form.price}
              onChange={handleChange}
              placeholder="Giá"
              type="number"
              min="0"
            />

            <select
              className="service-package-select"
              name="vehicleType"
              value={form.vehicleType}
              onChange={handleChange}
            >
              {VEHICLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatVehicleType(type)}
                </option>
              ))}
            </select>

            <select
              className="service-package-select"
              name="packageType"
              value={form.packageType}
              onChange={handleChange}
            >
              {PACKAGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatPackageType(type)}
                </option>
              ))}
            </select>

            <input
              className="service-package-input"
              name="durationMinutes"
              value={form.durationMinutes}
              onChange={handleChange}
              placeholder="Thời lượng phút"
              type="number"
              min="1"
            />

            <input
              className="service-package-input"
              name="includedServiceIds"
              value={form.includedServiceIds}
              onChange={handleChange}
              placeholder="Included service IDs, ví dụ: 1,2,3"
            />
          </div>

          <textarea
            className="service-package-textarea"
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Mô tả gói dịch vụ"
          />

          <textarea
            className="service-package-textarea"
            name="stepsTemplate"
            value={form.stepsTemplate}
            onChange={handleChange}
            placeholder={'Steps template, mỗi dòng là 1 bước\nVí dụ:\nKiểm tra xe\nRửa ngoại thất\nLau khô và bàn giao'}
            style={{ marginTop: 12 }}
          />

          <div className="service-package-actions" style={{ marginTop: 16 }}>
            <button className="service-package-primary-btn" disabled={saving}>
              {saving ? 'Đang lưu...' : editingId ? 'Cập nhật gói' : 'Tạo gói'}
            </button>

            {editingId && (
              <button className="service-package-ghost-btn" type="button" onClick={handleCancelEdit}>
                Hủy
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="service-package-panel">
        <div className="service-package-panel-header">
          <div>
            <h2>Danh sách service packages</h2>
            <p>Lọc và quản lý trạng thái hiển thị cho customer.</p>
          </div>
        </div>

        <div className="service-package-filters">
          <input
            className="service-package-input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm tên gói..."
          />

          <select
            className="service-package-select"
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
          >
            <option value="ALL">Tất cả loại xe</option>
            {VEHICLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatVehicleType(type)}
              </option>
            ))}
          </select>

          <select
            className="service-package-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">Tất cả loại gói</option>
            {PACKAGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatPackageType(type)}
              </option>
            ))}
          </select>

          <button
            className="service-package-ghost-btn"
            type="button"
            onClick={() => {
              setKeyword('')
              setVehicleFilter('ALL')
              setTypeFilter('ALL')
            }}
          >
            Xóa lọc
          </button>
        </div>

        {loading ? (
          <div className="service-package-empty">Đang tải service packages...</div>
        ) : filteredPackages.length === 0 ? (
          <div className="service-package-empty">Chưa có gói dịch vụ.</div>
        ) : (
          <div className="service-package-table-wrap">
            <table className="service-package-table">
              <thead>
                <tr>
                  <th>Tên gói</th>
                  <th>Loại xe</th>
                  <th>Type</th>
                  <th>Giá</th>
                  <th>Thời lượng</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {filteredPackages.map((item) => {
                  const id = getPackageId(item)
                  const active = getPackageActive(item)

                  return (
                    <tr key={id}>
                      <td>
                        <strong>{getPackageName(item)}</strong>
                        <div style={{ color: '#64748b', fontSize: 13 }}>
                          {item.description || '-'}
                        </div>
                      </td>
                      <td>{formatVehicleType(item.vehicleType)}</td>
                      <td>
                        <span className="service-package-pill">
                          {formatPackageType(getPackageType(item))}
                        </span>
                      </td>
                      <td>{money.format(Number(getPackagePrice(item)) || 0)}</td>
                      <td>{getPackageDuration(item) || '-'} phút</td>
                      <td>
                        <span className={`service-package-pill ${active ? 'green' : 'orange'}`}>
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="service-package-actions">
                          <button
                            className="service-package-ghost-btn"
                            type="button"
                            onClick={() => handleEdit(item)}
                          >
                            Sửa
                          </button>

                          <button
                            className="service-package-ghost-btn"
                            type="button"
                            onClick={() => handleToggleStatus(item)}
                          >
                            {active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function formatVehicleType(value) {
  if (value === 'CAR') return 'Ô tô'
  if (value === 'MOTORBIKE') return 'Xe máy'
  return value || '-'
}

function formatPackageType(value) {
  if (value === 'MAIN') return 'Main'
  if (value === 'ADD_ON') return 'Add-on'
  if (value === 'COMBO') return 'Combo'
  return value || '-'
}