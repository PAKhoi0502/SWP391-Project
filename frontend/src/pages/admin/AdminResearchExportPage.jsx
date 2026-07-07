import { useState } from 'react'
import researchExportApi from '../../api/researchExportApi'
import './AdminResearchExportPage.css'

const todayIso = () => new Date().toISOString().slice(0, 10)

const daysAgoIso = (days) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

const DATASETS = [
  { value: 'bookings', label: 'Booking dataset' },
  { value: 'customers', label: 'Customer dataset' },
]

const FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
]

function AdminResearchExportPage() {
  const [dataset, setDataset] = useState('bookings')
  const [format, setFormat] = useState('csv')
  const [from, setFrom] = useState(daysAgoIso(30))
  const [to, setTo] = useState(todayIso())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleExport = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const filters = { from: from || undefined, to: to || undefined, format }
      if (dataset === 'bookings') {
        await researchExportApi.exportBookings(filters)
      } else {
        await researchExportApi.exportCustomers(filters)
      }
      setMessage('Đã tải file xuất dữ liệu.')
    } catch (err) {
      setError(err.message || 'Không thể xuất dữ liệu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="research-export-page">
      <div className="research-export-hero">
        <p className="research-export-kicker">Research</p>
        <h1>Xuất dữ liệu nghiên cứu</h1>
        <p>Xuất dataset booking hoặc khách hàng đã được ẩn danh hoá phục vụ nghiên cứu.</p>
      </div>

      <div className="research-export-warning">
        Dữ liệu xuất ra đã được <strong>ẩn danh hoá</strong>: mã khách hàng/booking được băm một chiều, không chứa
        tên, số điện thoại, biển số xe hay bất kỳ thông tin định danh cá nhân (PII) nào.
        <br />
        Khoảng thời gian tối đa mỗi lần xuất là 366 ngày.
      </div>

      <form className="research-export-panel" onSubmit={handleExport}>
        <div className="research-export-field-row">
          <label>
            Dataset
            <select value={dataset} onChange={(e) => setDataset(e.target.value)}>
              {DATASETS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Từ ngày
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>

          <label>
            Đến ngày
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>

          <label>
            Định dạng
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {FORMATS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <div className="research-export-alert error">{error}</div>}
        {message && <div className="research-export-alert success">{message}</div>}

        <button className="research-export-primary-btn" type="submit" disabled={loading}>
          {loading ? 'Đang xuất...' : 'Tải xuống'}
        </button>
      </form>
    </section>
  )
}

export default AdminResearchExportPage
