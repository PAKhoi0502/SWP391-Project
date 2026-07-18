import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Area, AreaChart, CartesianGrid,
  Cell,
  Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import adminAnalyticsApi from '../../api/adminAnalyticsApi'
import { getGarages } from '../../api/GarageApi'
import { DashboardDateRangeFilter } from './dashboard/DashboardDateRangeFilter'
import { DashboardKpiGrid } from './dashboard/DashboardKpiGrid'
import { BookingManagementCard } from './dashboard/BookingManagementCard'
import { BookingCalendar } from './dashboard/BookingCalendar'
import {
  calcPreviousPeriod,
  daysAgoLocal,
  fmtNum,
  fmtRevShort,
  fmtVND,
  fmtDateTick,
  STATUS_COLORS_DONUT,
  STATUS_LABELS,
  todayLocal,
} from './dashboard/dashboardUtils'
import './AdminDashboardPage.css'

/* ── Table datasets ── */
const TABLE_DATASETS = [
  { id: 'payment',    label: 'Payment Methods' },
  { id: 'tiers',      label: 'Membership Tiers' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'washbays',   label: 'Wash Bay Performance' },
]

/* ════════════════════════════════════════════════════
   ICON — small SVG used inside dashboard cards
   ════════════════════════════════════════════════════ */
function DashIcon({ name, size = 17 }) {
  const paths = {
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    check:    <polyline points="20 6 9 17 4 12"/>,
    clock:    <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    x:        <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    alert:    <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    dots:     <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    check_sm: <polyline points="18 6 9 17 4 12"/>,
    chevron:  <polyline points="6 9 12 15 18 9"/>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      {paths[name] ?? null}
    </svg>
  )
}

/* ════════════════════════════════════════════════════
   EMPTY CHART PLACEHOLDER
   ════════════════════════════════════════════════════ */
function EmptyChart({ height = 190 }) {
  return (
    <div className="adash-empty-chart" style={{ height }}>
      <span>No data for selected period</span>
    </div>
  )
}

/* ════════════════════════════════════════════════════
   TREND CARD  (AreaChart, Bookings / Revenue tab)
   ════════════════════════════════════════════════════ */
function TrendTooltip({ active, payload, label, isRevenue }) {
  if (!active || !payload?.length) return null
  return (
    <div className="adash-tooltip">
      <p className="adash-tooltip-date">{fmtDateTick(label)}</p>
      <p className="adash-tooltip-val">
        {isRevenue ? fmtVND(payload[0].value) : fmtNum(payload[0].value)}
      </p>
    </div>
  )
}

function TrendCard({ bookings, revenue }) {
  const [tab, setTab] = useState('bookings')
  const isRevenue = tab === 'revenue'

  const data = useMemo(() => {
    if (isRevenue) {
      return (revenue?.byDate || []).map(d => ({ date: d.date, value: d.revenue }))
    }
    return (bookings?.byDate || []).map(d => ({ date: d.date, value: d.bookingCount }))
  }, [isRevenue, bookings, revenue])

  const summary = isRevenue
    ? `Total ${fmtVND(revenue?.totalRevenue)}  ·  Avg ${fmtVND(revenue?.averageRevenue)}`
    : `${fmtNum(bookings?.totalBookings)} bookings in period`

  return (
    <section className="adash-card adash-trend-card">
      <div className="adash-trend-header">
        <div>
          <h2 className="adash-card-title">Booking Trend</h2>
          <p className="adash-card-sub">{summary}</p>
        </div>
        <div className="adash-tabs" role="tablist">
          <button
            role="tab"
            className={`adash-tab${!isRevenue ? ' adash-tab--on' : ''}`}
            aria-selected={!isRevenue}
            onClick={() => setTab('bookings')}
          >Bookings</button>
          <button
            role="tab"
            className={`adash-tab${isRevenue ? ' adash-tab--on' : ''}`}
            aria-selected={isRevenue}
            onClick={() => setTab('revenue')}
          >Revenue</button>
        </div>
      </div>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="adash-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#2563eb" stopOpacity={0.28}/>
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtDateTick}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={isRevenue ? fmtRevShort : undefined}
              width={isRevenue ? 54 : 32}
            />
            <Tooltip
              content={<TrendTooltip isRevenue={isRevenue} />}
              wrapperStyle={{ transition: 'none', outline: 'none' }}
              cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill="url(#adash-grad)"
              dot={false}
              activeDot={{ r: 5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2.5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart height={190} />
      )}
    </section>
  )
}

/* ════════════════════════════════════════════════════
   DONUT CARD  (booking status breakdown)
   ════════════════════════════════════════════════════ */
function DonutCard({ bookings }) {
  const data = useMemo(() =>
    Object.entries(bookings?.byStatus || {})
      .map(([status, count]) => ({ status, count }))
      .filter(d => d.count > 0)
  , [bookings])

  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <section className="adash-card adash-donut-card">
      <h2 className="adash-card-title">Booking Status</h2>
      <p className="adash-card-sub">{fmtNum(total)} total</p>

      {data.length > 0 ? (
        <>
          <div className="adash-donut-wrap">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  innerRadius={60}
                  outerRadius={88}
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                >
                  {data.map(entry => (
                    <Cell key={entry.status} fill={STATUS_COLORS_DONUT[entry.status] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip
                  wrapperStyle={{ transition: 'none', outline: 'none' }}
                  formatter={(value, _name, props) => [
                    `${fmtNum(value)} (${Math.round(value / total * 100)}%)`,
                    STATUS_LABELS[props.payload.status] || props.payload.status,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="adash-donut-center" aria-hidden="true">
              <strong>{fmtNum(total)}</strong>
              <span>bookings</span>
            </div>
          </div>

          <ul className="adash-legend">
            {data.map(d => (
              <li key={d.status}>
                <span className="adash-legend-dot" style={{ background: STATUS_COLORS_DONUT[d.status] || '#94a3b8' }} />
                <span className="adash-legend-name">{STATUS_LABELS[d.status] || d.status}</span>
                <span className="adash-legend-val">{fmtNum(d.count)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyChart height={210} />
      )}
    </section>
  )
}

/* ════════════════════════════════════════════════════
   PERFORMANCE TABLE CARD  (4-dataset dropdown)
   ════════════════════════════════════════════════════ */
function getPerfSub(id, revenue, loyalty, promotions, washBays) {
  if (id === 'payment')    return revenue    ? `${(revenue.byPaymentMethod || []).length} payment methods tracked` : ''
  if (id === 'tiers')      return loyalty    ? `${fmtNum(loyalty.totalMembers)} members · ${fmtNum(loyalty.totalAvailablePoints)} pts available` : ''
  if (id === 'promotions') return promotions ? `${fmtNum(promotions.totalUsages)} uses · ${fmtVND(promotions.totalDiscountAmount)} discounted` : ''
  if (id === 'washbays')   return washBays   ? `${fmtNum(washBays.totalUsages)} uses · avg ${Math.round(washBays.averageUsageMinutes || 0)} min/use` : ''
  return ''
}

function renderPerfTable(id, revenue, loyalty, promotions, washBays) {
  if (id === 'payment') {
    const rows = revenue?.byPaymentMethod || []
    return (
      <table className="adash-table">
        <thead><tr><th>Method</th><th className="r">Paid bookings</th><th className="r">Revenue</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.paymentMethod}>
              <td>{r.paymentMethod}</td>
              <td className="r">{fmtNum(r.paidBookingCount)}</td>
              <td className="r">{fmtVND(r.revenue)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={3} className="adash-table-empty">No data</td></tr>}
        </tbody>
      </table>
    )
  }
  if (id === 'tiers') {
    const rows = loyalty?.byTier || []
    return (
      <table className="adash-table">
        <thead><tr><th>Tier</th><th className="r">Members</th><th className="r">Avail. pts</th><th className="r">Redeemed pts</th><th className="r">Total spent</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.tier}>
              <td><span className={`adash-tier adash-tier--${(r.tier||'').toLowerCase()}`}>{r.tier}</span></td>
              <td className="r">{fmtNum(r.memberCount)}</td>
              <td className="r">{fmtNum(r.availablePoints)}</td>
              <td className="r">{fmtNum(r.redeemedPoints)}</td>
              <td className="r">{fmtVND(r.totalSpent)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="adash-table-empty">No data</td></tr>}
        </tbody>
      </table>
    )
  }
  if (id === 'promotions') {
    const rows = promotions?.promotions || []
    return (
      <table className="adash-table">
        <thead><tr><th>Code</th><th>Name</th><th className="r">Uses</th><th className="r">Discount total</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.promotionId}>
              <td><code className="adash-code">{r.code}</code></td>
              <td>{r.name}</td>
              <td className="r">{fmtNum(r.usageCount)}</td>
              <td className="r">{fmtVND(r.discountAmount)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="adash-table-empty">No data</td></tr>}
        </tbody>
      </table>
    )
  }
  if (id === 'washbays') {
    const rows = washBays?.washBays || []
    return (
      <table className="adash-table">
        <thead><tr><th>Bay</th><th>Vehicle type</th><th className="r">Uses</th><th className="r">Total min</th><th className="r">Avg min/use</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.washBayId}>
              <td><span className="adash-bay">{r.bayCode}</span></td>
              <td>{r.vehicleType}</td>
              <td className="r">{fmtNum(r.usageCount)}</td>
              <td className="r">{fmtNum(r.usageMinutes)}</td>
              <td className="r">{Math.round(r.averageUsageMinutes || 0)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="adash-table-empty">No data</td></tr>}
        </tbody>
      </table>
    )
  }
  return null
}

function PerformanceTableCard({ revenue, loyalty, promotions, washBays }) {
  const [selected, setSelected] = useState('payment')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    const esc   = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [menuOpen])

  const currentLabel = TABLE_DATASETS.find(d => d.id === selected)?.label ?? ''

  return (
    <section className="adash-card adash-perf-card">
      <div className="adash-perf-hdr">
        <div>
          <h2 className="adash-card-title">{currentLabel}</h2>
          <p className="adash-card-sub">{getPerfSub(selected, revenue, loyalty, promotions, washBays)}</p>
        </div>

        <div className="adash-dropdown-wrap" ref={menuRef}>
          <button
            className="adash-switch-btn"
            onClick={() => setMenuOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            aria-label="Switch dataset"
          >
            <DashIcon name="dots" size={15} />
            <span>Switch view</span>
            <span className={`adash-switch-chevron${menuOpen ? ' open' : ''}`}>
              <DashIcon name="chevron" size={13} />
            </span>
          </button>

          {menuOpen && (
            <ul className="adash-dropdown" role="listbox">
              {TABLE_DATASETS.map(d => (
                <li
                  key={d.id}
                  role="option"
                  aria-selected={d.id === selected}
                  className={d.id === selected ? 'active' : ''}
                  tabIndex={0}
                  onClick={() => { setSelected(d.id); setMenuOpen(false) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') { setSelected(d.id); setMenuOpen(false) }
                  }}
                >
                  <span className="adash-dropdown-check">
                    {d.id === selected && <DashIcon name="check_sm" size={13} />}
                  </span>
                  {d.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="adash-table-wrap">
        {renderPerfTable(selected, revenue, loyalty, promotions, washBays)}
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════ */
const defaultFilters = () => ({
  from:     daysAgoLocal(30),
  to:       todayLocal(),
  garageId: '',
})

export default function AdminDashboardPage() {
  const [garages,         setGarages]         = useState([])
  const [servicePackages, setServicePackages]  = useState([])
  const [filters,         setFilters]          = useState(defaultFilters)
  const [applied,         setApplied]          = useState(defaultFilters)
  const [loading,         setLoading]          = useState(true)
  const [error,           setError]            = useState('')

  const [bookings,          setBookings]          = useState(null)
  const [previousBookings,  setPreviousBookings]  = useState(null)
  const [comparisonAvailable, setComparisonAvailable] = useState(false)
  const [revenue,           setRevenue]           = useState(null)
  const [loyalty,           setLoyalty]           = useState(null)
  const [promotions,        setPromotions]        = useState(null)
  const [washBays,          setWashBays]          = useState(null)

  /* Calendar ↔ table coordination state */
  const [calendarDate, setCalendarDate] = useState(null)
  const [calFilters,   setCalFilters]   = useState({ garageId: '', servicePackageId: '' })

  // Fetch garages and service packages on mount
  useEffect(() => {
    getGarages({ limit: 100 })
      .then(r => setGarages(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setGarages([]))

    adminAnalyticsApi.getServicePackages()
      .then(r => setServicePackages(Array.isArray(r) ? r : r?.data ?? []))
      .catch(() => setServicePackages([]))
  }, [])

  // Fetch analytics when applied filters change
  useEffect(() => {
    let cancelled = false

    const p = {
      from:     applied.from     || undefined,
      to:       applied.to       || undefined,
      garageId: applied.garageId || undefined,
    }

    const { prevFrom, prevTo } = calcPreviousPeriod(
      applied.from || daysAgoLocal(30),
      applied.to   || todayLocal(),
    )
    const prev = { from: prevFrom, to: prevTo, garageId: applied.garageId || undefined }

    function runFetch() {
      setLoading(true)
      setError('')

      Promise.allSettled([
        adminAnalyticsApi.getBookingStatistics(p),
        adminAnalyticsApi.getRevenueStatistics(p),
        adminAnalyticsApi.getLoyaltyStatistics(p),
        adminAnalyticsApi.getPromotionPerformance(p),
        adminAnalyticsApi.getWashBayPerformance(p),
        adminAnalyticsApi.getBookingStatistics(prev),
      ]).then(([bkR, rvR, lyR, prR, wbR, pbkR]) => {
        if (cancelled) return

        setBookings(   bkR.status === 'fulfilled' ? bkR.value : null)
        setRevenue(    rvR.status === 'fulfilled' ? rvR.value : null)
        setLoyalty(    lyR.status === 'fulfilled' ? lyR.value : null)
        setPromotions( prR.status === 'fulfilled' ? prR.value : null)
        setWashBays(   wbR.status === 'fulfilled' ? wbR.value : null)

        if (pbkR.status === 'fulfilled') {
          setPreviousBookings(pbkR.value)
          setComparisonAvailable(true)
        } else {
          setPreviousBookings(null)
          setComparisonAvailable(false)
        }

        if (bkR.status === 'rejected' && rvR.status === 'rejected') {
          const msg = bkR.reason?.response?.data?.message || bkR.reason?.message || 'Unable to load statistics'
          setError(msg)
        }
      }).finally(() => { if (!cancelled) setLoading(false) })
    }

    runFetch()
    return () => { cancelled = true }
  }, [applied])

  const handleApply = (val) => {
    setApplied(val)
    setFilters(val)
  }

  const handleReset = () => {
    const def = defaultFilters()
    setFilters(def)
    setApplied(def)
  }

  return (
    <div className="adash-page">

      {/* ── Filter bar ── */}
      <div className="adash-topbar">
        <div className="adash-topbar-title">
          <h1>Dashboard</h1>
          <p>Analytics &amp; performance overview</p>
        </div>
        <div className="adash-topbar-filter">
          <DashboardDateRangeFilter
            value={filters}
            garages={garages}
            onChange={setFilters}
            onApply={handleApply}
            onReset={handleReset}
          />
        </div>
      </div>

      {/* ── Alerts ── */}
      {error   && <div className="adash-alert adash-alert--error">{error}</div>}
      {loading && <div className="adash-alert adash-alert--info">Loading…</div>}

      {/* ── KPI row ── */}
      <DashboardKpiGrid
        bookings={bookings}
        previousBookings={previousBookings}
        comparisonAvailable={comparisonAvailable}
      />

      {/* ── Booking Management + Calendar row ── */}
      <div className="adash-bm-row">
        <BookingManagementCard
          garages={garages}
          servicePackages={servicePackages}
          selectedDate={calendarDate}
          onFiltersChange={setCalFilters}
        />
        <BookingCalendar
          selectedDate={calendarDate}
          onSelectDate={setCalendarDate}
          garageId={calFilters.garageId}
          servicePackageId={calFilters.servicePackageId}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="adash-analytics-row">
        <TrendCard bookings={bookings} revenue={revenue} />
        <DonutCard bookings={bookings} />
      </div>

      {/* ── Performance table ── */}
      <PerformanceTableCard
        revenue={revenue}
        loyalty={loyalty}
        promotions={promotions}
        washBays={washBays}
      />
    </div>
  )
}
