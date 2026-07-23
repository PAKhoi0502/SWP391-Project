import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getGarages, getGarageById } from '../api/GarageApi'
import { useAuth } from '../contexts/AuthContext'
import GarageServiceResults from './GarageServiceResults'
import './GaragePage.css'

function IconMapPin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

function IconPhone() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.95 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.9 2.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
}

function IconClock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <polyline points="12 7 12 12 15 14"/>
    </svg>
  )
}

function SkeletonGrid() {
  return (
    <div className="garage-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="garage-card" style={{ display: 'grid', gap: 10 }}>
          <div style={{ background: '#e8edf2', borderRadius: 8, height: 14, width: '60%' }} />
          <div style={{ background: '#e8edf2', borderRadius: 8, height: 24, width: '80%' }} />
          <div style={{ background: '#e8edf2', borderRadius: 8, height: 12, width: '55%' }} />
          <div style={{ background: '#e8edf2', borderRadius: 8, height: 12, width: '70%' }} />
          <div style={{ background: '#e8edf2', borderRadius: 8, height: 12, width: '50%' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <div style={{ background: '#e8edf2', borderRadius: 999, height: 40, flex: 1 }} />
            <div style={{ background: '#e8edf2', borderRadius: 999, height: 40, flex: 1 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function GarageListPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [garages, setGarages] = useState([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedGarage, setSelectedGarage] = useState(null)

  // Initial load from GarageDetailPage "View Services" → navigate with state
  useEffect(() => {
    const targetId = location.state?.selectedGarageId
    if (!targetId) return

    // Clear the navigation state so a page refresh doesn't re-trigger
    navigate('/customer/garages', { replace: true, state: {} })

    let active = true
    getGarageById(targetId)
      .then((data) => { if (active) setSelectedGarage(data) })
      .catch(() => { /* silently ignore — garage list is still shown */ })
    return () => { active = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchGarages(searchValue = '') {
    try {
      setLoading(true)
      setError('')
      const result = await getGarages({ page: 1, limit: 20, isActive: true, keyword: searchValue })
      setGarages(result.data || [])
    } catch (err) {
      setError(err.message || 'Could not load the garage list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGarages() }, [])

  function handleSearch(e) {
    e.preventDefault()
    fetchGarages(keyword)
  }

  // When a garage is selected, show GarageServiceResults inline
  if (selectedGarage) {
    return (
      <div className="spp-page">
        <div className="spp-content">
          <GarageServiceResults
            key={selectedGarage.id}
            garage={selectedGarage}
            onBack={() => setSelectedGarage(null)}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="garage-page">
      <div className="garage-header">
        <p className="garage-eyebrow">AutoWash Pro</p>
        <h1>Our Garages</h1>
        <p>Find the garage nearest to you — view its address, opening hours, and book the service you need directly.</p>
      </div>

      <form className="garage-search" onSubmit={handleSearch}>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search by name, address, city…"
        />
        <button type="submit">Search</button>
      </form>

      {error && <div className="garage-error">{error}</div>}

      {loading ? (
        <SkeletonGrid />
      ) : !error && garages.length === 0 ? (
        <p className="garage-muted">No garages found. Try a different search term.</p>
      ) : !error ? (
        <div className="garage-grid">
          {garages.map((garage) => (
            <div className="garage-card" key={garage.id}>
              <div className="garage-card-top">
                <div>
                  <p className="garage-code">{garage.garageCode}</p>
                  <h3>{garage.name}</h3>
                </div>
                <span className={garage.isActive ? 'garage-status on' : 'garage-status off'}>
                  {garage.isActive ? 'Active' : 'Suspended'}
                </span>
              </div>

              <p className="garage-info" style={{ marginTop: 10 }}>
                <IconMapPin /> {garage.address}, {garage.city}
              </p>
              <p className="garage-info">
                <IconPhone /> {garage.phone}
              </p>
              <p className="garage-info">
                <IconClock /> {garage.openingTime} – {garage.closingTime}
              </p>

              <div className="garage-card-actions">
                <button
                  type="button"
                  className="garage-btn-primary"
                  onClick={() => setSelectedGarage(garage)}
                >
                  View Services
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
