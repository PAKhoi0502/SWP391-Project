import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
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
  getServicePackages,
} from '../services/servicePackageApi'
import './PublicServicePackagePage.css'

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

function formatVehicleType(value) {
  const v = String(value || '').toUpperCase()
  if (v === 'CAR') return 'Car'
  if (v === 'BIKE' || v === 'MOTORBIKE') return 'Motorbike'
  return 'All vehicles'
}

function formatPackageType(value) {
  if (value === 'MAIN')   return 'Main'
  if (value === 'ADD_ON') return 'Add-on'
  if (value === 'COMBO')  return 'Combo'
  return value || '—'
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

const VEHICLE_ALL     = ''
const PAGE_SIZE       = 9
const VEHICLE_OPTIONS = [
  { value: '',     label: 'All' },
  { value: 'CAR',  label: 'Car' },
  { value: 'BIKE', label: 'Motorbike' },
]

function SkeletonGrid() {
  return (
    <div className="spp-grid">
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <div key={i} className="spp-skeleton-card">
          <div className="spp-skel spp-skel--h10 spp-skel--w40" />
          <div className="spp-skel spp-skel--h20 spp-skel--w80" />
          <div className="spp-skel spp-skel--h10 spp-skel--w60" style={{ marginTop: 4 }} />
          <div className="spp-skel spp-skel--h10 spp-skel--w80" />
          <div className="spp-skel spp-skel--h10 spp-skel--w60" style={{ marginTop: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <div className="spp-skel spp-skel--h14" style={{ flex: 1 }} />
            <div className="spp-skel spp-skel--h14" style={{ flex: 1 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ServicePackageListPage() {
  const { isAuthenticated } = useAuth()

  const [packages, setPackages] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const [keyword,     setKeyword]     = useState('')
  const [vehicleType, setVehicleType] = useState('CAR')
  const [packageType, setPackageType] = useState('')

  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(loadPackages, 280)
    return () => clearTimeout(debounceRef.current)
  }, [vehicleType])

  async function loadPackages() {
    setLoading(true)
    setError('')
    try {
      if (!vehicleType) {
        // "All" selected — /available requires vehicleType, so fall back to base endpoint
        const data = await getServicePackages({})
        setPackages(extractList(data).filter((item) => getPackageActive(item)))
      } else {
        try {
          const data = await getAvailableServicePackages({ vehicleType })
          setPackages(extractList(data))
        } catch (e) {
          if (e?.response?.status !== 404) throw e
          const data = await getServicePackages({ vehicleType })
          setPackages(extractList(data).filter((item) => getPackageActive(item)))
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load service packages.'))
    } finally {
      setLoading(false)
    }
  }

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
    setVehicleType('CAR')
    setPackageType('')
  }

  const hasFilters = keyword !== '' || vehicleType !== 'CAR' || packageType !== ''

  const countByType = (type) => packages.filter((p) => getPackageActive(p) && getPackageType(p) === type).length

  return (
    <div className="spp-page">
      <div className="spp-content">

        {/* ── Hero ── */}
        <div className="spp-hero">
          <div className="spp-hero-text">
            <p className="spp-hero-eyebrow">Service Packages</p>
            <h1 className="spp-hero-title">Professional Car&nbsp;Care</h1>
            <p className="spp-hero-desc">
              Choose the perfect package for your vehicle. Filter by vehicle type,
              package category, or search by name — then book in seconds.
            </p>
          </div>

          <div className="spp-stats">
            <div className="spp-stat">
              <strong>{packages.filter(getPackageActive).length}</strong>
              <span>Total</span>
            </div>
            <div className="spp-stat">
              <strong>{countByType('MAIN')}</strong>
              <span>Main</span>
            </div>
            <div className="spp-stat">
              <strong>{countByType('COMBO')}</strong>
              <span>Combo</span>
            </div>
            <div className="spp-stat">
              <strong>{countByType('ADD_ON')}</strong>
              <span>Add-on</span>
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="spp-filter-section">
          <div className="spp-search-wrap">
            <span className="spp-search-icon"><IconSearch /></span>
            <input
              className="spp-search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search packages by name…"
            />
          </div>

          <div className="spp-filter-rows">
            <div className="spp-filter-group">
              <span className="spp-filter-label">Vehicle</span>
              {VEHICLE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`spp-pill${vehicleType === value ? ' spp-pill--active' : ''}`}
                  onClick={() => setVehicleType(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="spp-filter-sep" />

            <div className="spp-filter-group">
              <span className="spp-filter-label">Type</span>
              <button
                type="button"
                className={`spp-pill${packageType === '' ? ' spp-pill--active' : ''}`}
                onClick={() => setPackageType('')}
              >
                All
              </button>
              {PACKAGE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`spp-pill${packageType === type ? ' spp-pill--active' : ''}`}
                  onClick={() => setPackageType(type)}
                >
                  {formatPackageType(type)}
                </button>
              ))}
            </div>

            {hasFilters && (
              <button type="button" className="spp-clear-btn" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ── Results count ── */}
        {!loading && !error && (
          <div className="spp-results-head">
            <span className="spp-results-count">
              {filteredPackages.length} package{filteredPackages.length !== 1 ? 's' : ''} found
            </span>
          </div>
        )}

        {/* ── Error ── */}
        {error && <div className="spp-error">{error}</div>}

        {/* ── Grid / States ── */}
        {loading ? (
          <SkeletonGrid />
        ) : !error && filteredPackages.length === 0 ? (
          <div className="spp-grid">
            <div className="spp-empty">
              <div className="spp-empty-icon"><IconCar /></div>
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
                isAuthenticated={isAuthenticated}
                delay={idx * 0.045}
              />
            ))}
          </div>
        ) : null}

      </div>
    </div>
  )
}

function PackageCard({ item, isAuthenticated, delay }) {
  const id       = getPackageId(item)
  const price    = getPackagePrice(item)
  const duration = getPackageDuration(item)
  const type     = getPackageType(item)
  const name     = getPackageName(item)

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
        <Link to={`/customer/service-packages/${id}`} className="spp-detail-btn">
          View Details
        </Link>
        <Link
          to={isAuthenticated ? '/booking' : '/login'}
          className="spp-book-btn"
        >
          Book Now
        </Link>
      </div>
    </div>
  )
}
