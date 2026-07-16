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
      setMessage('Export file downloaded.')
    } catch (err) {
      setError(err.message || 'Unable to export data.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="research-export-page">
      <div className="research-export-hero">
        <p className="research-export-kicker">Research</p>
        <h1>Export Research Data</h1>
        <p>Export anonymized booking or customer datasets for research purposes.</p>
      </div>

      <div className="research-export-warning">
        The exported data is <strong>anonymized</strong>: customer/booking IDs are one-way hashed and contain no
        names, phone numbers, license plates, or any personally identifiable information (PII).
        <br />
        The maximum date range per export is 366 days.
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
            From date
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>

          <label>
            To date
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>

          <label>
            Format
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
          {loading ? 'Exporting...' : 'Download'}
        </button>
      </form>
    </section>
  )
}

export default AdminResearchExportPage
