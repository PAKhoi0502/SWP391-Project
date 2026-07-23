import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getGarages, getGarageById } from '../api/GarageApi'
import GarageServiceResults from './GarageServiceResults'
import './PublicServicePackagePage.css'
import './GaragePickerStep.css'

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

function IconMapPin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

/* ── Step 1: Garage picker ────────────────────────────────────────────────── */

function GaragePickerStep({ onSelectGarage }) {
  const [garages, setGarages] = useState([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchGarages(kw = '') {
    setLoading(true)
    setError('')
    try {
      const result = await getGarages({ page: 1, limit: 20, isActive: true, keyword: kw })
      setGarages(result.data || [])
    } catch (err) {
      setError(err.message || 'Could not load garages')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGarages() }, [])

  function handleSearch(e) {
    e.preventDefault()
    fetchGarages(keyword)
  }

  return (
    <div className="spp-page">
      <div className="spp-content">
        <div className="spp-hero">
          <div className="spp-hero-text">
            <p className="spp-hero-eyebrow">Service Packages</p>
            <h1 className="spp-hero-title">Choose a Garage</h1>
            <p className="spp-hero-desc">
              Select the garage you want to visit. We&apos;ll show you the services available at that location.
            </p>
          </div>
        </div>

        <form className="gps-search" onSubmit={handleSearch}>
          <span className="gps-search-icon"><IconSearch /></span>
          <input
            className="gps-search-input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search by name, city…"
          />
          <button className="gps-search-btn" type="submit">Search</button>
        </form>

        {error && <div className="spp-error">{error}</div>}

        {loading ? (
          <div className="gps-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="gps-card gps-card--skeleton">
                <div className="gps-skel" style={{ width: '40%', height: 12 }} />
                <div className="gps-skel" style={{ width: '75%', height: 22, marginTop: 6 }} />
                <div className="gps-skel" style={{ width: '60%', height: 12, marginTop: 10 }} />
                <div className="gps-skel" style={{ width: '50%', height: 12, marginTop: 6 }} />
                <div className="gps-skel" style={{ borderRadius: 999, height: 40, marginTop: 16 }} />
              </div>
            ))}
          </div>
        ) : garages.length === 0 ? (
          <p style={{ color: '#667085' }}>No garages found. Try a different search.</p>
        ) : (
          <div className="gps-grid">
            {garages.map((garage) => (
              <button
                key={garage.id}
                type="button"
                className="gps-card"
                onClick={() => onSelectGarage(garage)}
              >
                <span className="gps-code">{garage.garageCode}</span>
                <span className="gps-name">{garage.name}</span>
                <span className="gps-info">
                  <IconMapPin /> {garage.address}, {garage.city}
                </span>
                <span className="gps-info">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <polyline points="12 7 12 12 15 14"/>
                  </svg>
                  {garage.openingTime} – {garage.closingTime}
                </span>
                <span className="gps-cta">View Services →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────────────────────── */

export default function ServicePackageListPage() {
  const { isAuthenticated } = useAuth()
  const [searchParams] = useSearchParams()

  const [selectedGarage, setSelectedGarage] = useState(null)

  // One-time init from URL ?garageId= (e.g. when landing via direct link)
  useEffect(() => {
    const garageIdParam = searchParams.get('garageId')
    if (!garageIdParam) return

    let active = true
    getGarageById(garageIdParam)
      .then((data) => { if (active) setSelectedGarage(data) })
      .catch(() => { /* silently fail — user sees picker to choose again */ })
    return () => { active = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!selectedGarage) {
    return <GaragePickerStep onSelectGarage={setSelectedGarage} />
  }

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
