import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBookingEntry } from '../hooks/useBookingEntry'
import {
  PACKAGE_TYPES,
  extractList,
  getAvailableServicePackages,
  getErrorMessage,
  getPackageActive,
  getPackageDuration,
  getPackageId,
  getPackageName,
  getPackagePrice,
  getPackageType,
} from '../services/servicePackageApi'
import './GarageServiceResults.css'
import './PublicServicePackagePage.css'

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

const VEHICLE_OPTIONS = [
  { value: '',     label: 'All' },
  { value: 'CAR',  label: 'Car' },
  { value: 'BIKE', label: 'Motorbike' },
]

function formatPackageType(value) {
  if (value === 'MAIN')   return 'Main'
  if (value === 'ADD_ON') return 'Add-on'
  if (value === 'COMBO')  return 'Combo'
  return value || '—'
}

function formatVehicleType(value) {
  const v = String(value || '').toUpperCase()
  if (v === 'CAR') return 'Car'
  if (v === 'BIKE' || v === 'MOTORBIKE') return 'Motorbike'
  return 'All types'
}

function badgeClass(type) {
  if (type === 'ADD_ON') return 'spp-badge spp-badge--add_on'
  if (type === 'COMBO')  return 'spp-badge spp-badge--combo'
  return 'spp-badge spp-badge--main'
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

function IconClock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <polyline points="12 7 12 12 15 14"/>
    </svg>
  )
}

function IconCar() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 11l1.7-4.3A2 2 0 0 1 8.6 5.5h6.8a2 2 0 0 1 1.9 1.2L19 11"/>
      <path d="M3 11h18v5.2a.8.8 0 0 1-.8.8H18"/>
      <path d="M6 17H3.8a.8.8 0 0 1-.8-.8V11"/>
      <circle cx="7.5" cy="17" r="1.7"/>
      <circle cx="16.5" cy="17" r="1.7"/>
    </svg>
  )
}

function IconArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
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

function IconPhone() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.95 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.9 2.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
}

function IconTime() {
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
    <div className="spp-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="gsr-skeleton-card">
          <div className="gsr-skel gsr-skel--h10 gsr-skel--w40" />
          <div className="gsr-skel gsr-skel--h20 gsr-skel--w80" />
          <div className="gsr-skel gsr-skel--h10 gsr-skel--w60" style={{ marginTop: 4 }} />
          <div className="gsr-skel gsr-skel--h10 gsr-skel--w80" />
          <div className="gsr-skel gsr-skel--h10 gsr-skel--w60" style={{ marginTop: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <div className="gsr-skel gsr-skel--h14" style={{ flex: 1 }} />
            <div className="gsr-skel gsr-skel--h14" style={{ flex: 1 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function PackageCard({ item, garageId, delay }) {
  const id       = getPackageId(item)
  const price    = getPackagePrice(item)
  const duration = getPackageDuration(item)
  const type     = getPackageType(item)
  const name     = getPackageName(item)
  const handleBookingEntry = useBookingEntry()

  return (
    <div className="spp-card" style={{ animationDelay: `${delay}s` }}>
      <div className="spp-card-head">
        <div className="spp-card-badges">
          <span className={badgeClass(type)}>{formatPackageType(type)}</span>
          {item.vehicleType && (
            <span className="spp-badge spp-badge--vehicle">{formatVehicleType(item.vehicleType)}</span>
          )}
        </div>
        {duration > 0 && (
          <span className="spp-card-duration">
            <IconClock /> {duration} min
          </span>
        )}
      </div>

      <h3 className="spp-card-name">{name}</h3>
      <p className="spp-card-desc">
        {item.description || item.shortDescription || 'Professional vehicle care package.'}
      </p>

      <div className="spp-card-price">
        <span className="spp-price-label">Starting from</span>
        <strong className="spp-price-value">{money.format(Number(price) || 0)}</strong>
      </div>

      <div className="spp-card-actions">
        <Link
          to={`/customer/service-packages/${id}?garageId=${garageId}`}
          className="spp-detail-btn"
        >
          View Details
        </Link>
        <button className="spp-book-btn" onClick={() => handleBookingEntry({ garageId, servicePackageId: id })}>
          Book Now
        </button>
      </div>
    </div>
  )
}

export default function GarageServiceResults({ garage, onBack }) {
  const [packages, setPackages] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const [keyword,     setKeyword]     = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [packageType, setPackageType] = useState('')

  const debounceRef = useRef(null)

  const loadPackages = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { garageId: garage.id }
      if (vehicleType) params.vehicleType = vehicleType
      const data = await getAvailableServicePackages(params)
      setPackages(extractList(data))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load service packages for this garage.'))
      setPackages([])
    } finally {
      setLoading(false)
    }
  }, [garage.id, vehicleType])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(loadPackages, 280)
    return () => clearTimeout(debounceRef.current)
  }, [loadPackages])

  const filteredPackages = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return packages.filter((item) => {
      if (!getPackageActive(item)) return false
      if (kw && !getPackageName(item).toLowerCase().includes(kw)) return false
      if (packageType && getPackageType(item) !== packageType) return false
      return true
    })
  }, [packages, keyword, packageType])

  function clearFilters() {
    setKeyword('')
    setVehicleType('')
    setPackageType('')
  }

  const hasFilters = keyword !== '' || vehicleType !== '' || packageType !== ''
  const countByType = (t) => packages.filter((p) => getPackageActive(p) && getPackageType(p) === t).length

  return (
    <div className="gsr-wrap">
      <button type="button" className="gsr-back" onClick={onBack}>
        <IconArrowLeft /> Back to garages
      </button>

      {/* ── Garage header card ── */}
      <div className="gsr-header-card">
        <div className="gsr-garage-meta">
          <span className="gsr-garage-eyebrow">{garage.garageCode}</span>
          <h2 className="gsr-garage-name">{garage.name}</h2>
          <div className="gsr-garage-info-row">
            <span className="gsr-garage-info"><IconMapPin /> {garage.address}, {garage.city}</span>
            <span className="gsr-garage-info"><IconPhone /> {garage.phone}</span>
            <span className="gsr-garage-info"><IconTime /> {garage.openingTime} – {garage.closingTime}</span>
          </div>
        </div>

        <div className="gsr-stats">
          <div className="gsr-stat">
            <strong>{packages.filter(getPackageActive).length}</strong>
            <span>Total</span>
          </div>
          <div className="gsr-stat">
            <strong>{countByType('MAIN')}</strong>
            <span>Main</span>
          </div>
          <div className="gsr-stat">
            <strong>{countByType('COMBO')}</strong>
            <span>Combo</span>
          </div>
          <div className="gsr-stat">
            <strong>{countByType('ADD_ON')}</strong>
            <span>Add-on</span>
          </div>
        </div>

      </div>

      {/* ── Filters ── */}
      <div className="gsr-filter-section">
        <div className="gsr-search-wrap">
          <span className="gsr-search-icon"><IconSearch /></span>
          <input
            className="gsr-search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search packages by name…"
          />
        </div>

        <div className="gsr-filter-rows">
          <div className="gsr-filter-group">
            <span className="gsr-filter-label">Vehicle</span>
            {VEHICLE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`gsr-pill${vehicleType === value ? ' gsr-pill--active' : ''}`}
                onClick={() => setVehicleType(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="gsr-filter-sep" />

          <div className="gsr-filter-group">
            <span className="gsr-filter-label">Type</span>
            <button
              type="button"
              className={`gsr-pill${packageType === '' ? ' gsr-pill--active' : ''}`}
              onClick={() => setPackageType('')}
            >
              All
            </button>
            {PACKAGE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`gsr-pill${packageType === t ? ' gsr-pill--active' : ''}`}
                onClick={() => setPackageType(t)}
              >
                {formatPackageType(t)}
              </button>
            ))}
          </div>

          {hasFilters && (
            <button type="button" className="gsr-clear-btn" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Results count ── */}
      {!loading && !error && (
        <div className="gsr-results-head">
          <span className="gsr-results-count">
            {filteredPackages.length} package{filteredPackages.length !== 1 ? 's' : ''} found
          </span>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="gsr-error">
          <span>{error}</span>
          <button type="button" className="gsr-retry-btn" onClick={loadPackages}>
            Retry
          </button>
        </div>
      )}

      {/* ── Grid / States ── */}
      {loading ? (
        <SkeletonGrid />
      ) : !error && filteredPackages.length === 0 ? (
        <div className="spp-grid">
          <div className="gsr-empty">
            <div className="gsr-empty-icon"><IconCar /></div>
            <p>No packages found</p>
            <span>Try adjusting your filters or search term.</span>
          </div>
        </div>
      ) : !error ? (
        <div className="spp-grid">
          {filteredPackages.map((item, idx) => (
            <PackageCard
              key={getPackageId(item)}
              item={item}
              garageId={garage.id}
              delay={idx * 0.045}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
