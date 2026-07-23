import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getGarageById, getGarageCapabilities } from '../api/GarageApi'
import './GaragePage.css'

function IconArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  )
}

function IconServices() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  )
}

function formatVehicleType(type) {
  const v = String(type || '').toUpperCase()
  if (v === 'CAR') return 'Car'
  if (v === 'BIKE' || v === 'MOTORBIKE') return 'Motorbike'
  return type
}

export default function GarageDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const isAdmin = location.pathname.startsWith('/admin')
  const backPath = isAdmin ? '/admin/garages' : '/customer/garages'

  const [garage, setGarage] = useState(null)
  const [capabilities, setCapabilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchDetail() {
      try {
        setLoading(true)
        setError('')
        const [garageData, capabilityData] = await Promise.all([
          getGarageById(id),
          getGarageCapabilities(id),
        ])
        setGarage(garageData)
        setCapabilities(capabilityData.supportedVehicleTypes || [])
      } catch (err) {
        setError(err.message || 'Could not load garage details')
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [id])

  if (loading) {
    return <div className="garage-page">Loading garage details…</div>
  }

  if (error) {
    return <div className="garage-page garage-error">{error}</div>
  }

  if (!garage) {
    return <div className="garage-page">Garage not found.</div>
  }

  return (
    <div className="garage-page">
      <Link to={backPath} className="garage-back">
        <IconArrowLeft /> Back to garage list
      </Link>

      <div className="garage-detail-card">
        <p className="garage-eyebrow">Garage Detail</p>
        <h1>{garage.name}</h1>

        <div className="garage-detail-info">
          <p><strong>Garage code:</strong> {garage.garageCode}</p>
          <p><strong>Address:</strong> {garage.address}, {garage.city}</p>
          <p><strong>Phone number:</strong> {garage.phone}</p>
          <p><strong>Opening hours:</strong> {garage.openingTime} – {garage.closingTime}</p>
          <p><strong>Slot interval:</strong> {garage.slotIntervalMinutes} min</p>
          <p>
            <strong>Status:</strong>{' '}
            <span className={garage.isActive ? 'garage-status on' : 'garage-status off'}>
              {garage.isActive ? 'Active' : 'Suspended'}
            </span>
          </p>
        </div>

        {/* Only show "View Services" for customer-facing pages */}
        {!isAdmin && (
          <button
            type="button"
            className="garage-view-services-btn"
            onClick={() => navigate('/customer/garages', { state: { selectedGarageId: garage.id } })}
          >
            <IconServices /> View Services at This Garage
          </button>
        )}
      </div>

      <div className="garage-section">
        <h2>Service Capabilities</h2>

        {capabilities.length === 0 ? (
          <p className="garage-muted">This garage has no wash bays or supported vehicle types yet.</p>
        ) : (
          <div className="capability-grid">
            {capabilities.map((type) => (
              <div className="capability-card" key={type}>
                <h3>{formatVehicleType(type)}</h3>
                <p className="garage-muted">This garage supports servicing this vehicle type.</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
