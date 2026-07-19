import { useEffect, useRef, useState } from 'react'
import { DashIcon } from './DashboardIcons'
import { fmtDateDisplay, todayLocal } from './dashboardUtils'

function DatePopover({ label, value, max, min, onSelect, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handleDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div className="drf-popover" ref={ref} role="dialog" aria-label={label}>
      <p className="drf-popover-title">{label}</p>
      <input
        type="date"
        className="drf-popover-input"
        value={value || ''}
        max={max}
        min={min}
        onChange={e => onSelect(e.target.value)}
        autoFocus
      />
      <div className="drf-popover-actions">
        <button
          type="button"
          className="drf-popover-btn"
          onClick={() => { onSelect(todayLocal()); onClose() }}
        >Today</button>
        <button
          type="button"
          className="drf-popover-btn drf-popover-btn--ghost"
          onClick={() => { onSelect(''); onClose() }}
        >Clear</button>
      </div>
    </div>
  )
}

export function DashboardDateRangeFilter({ value, garages, onChange, onApply, onReset }) {
  const [fromOpen, setFromOpen] = useState(false)
  const [toOpen,   setToOpen]   = useState(false)

  const { from, to, garageId } = value || {}

  const handleFrom = (v) => {
    const next = { ...value, from: v }
    // Ensure from <= to
    if (v && next.to && v > next.to) next.to = v
    onChange(next)
  }

  const handleTo = (v) => {
    const next = { ...value, to: v }
    // Ensure to >= from
    if (v && next.from && v < next.from) next.from = v
    onChange(next)
  }

  const isValid = !from || !to || from <= to

  const closeFrom = () => setFromOpen(false)
  const closeTo   = () => setToOpen(false)

  return (
    <div className="drf-bar">
      {/* From date button */}
      <div className="drf-field-wrap">
        <label className="drf-label">From</label>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={`drf-date-btn${fromOpen ? ' drf-date-btn--open' : ''}`}
            onClick={() => { setFromOpen(o => !o); setToOpen(false) }}
            aria-haspopup="dialog"
            aria-expanded={fromOpen}
          >
            <DashIcon name="calendar" size={14} />
            <span>{from ? fmtDateDisplay(from) : 'Select date'}</span>
          </button>
          {fromOpen && (
            <DatePopover
              label="From date"
              value={from}
              max={to || undefined}
              onSelect={v => { handleFrom(v); setFromOpen(false) }}
              onClose={closeFrom}
            />
          )}
        </div>
      </div>

      <span className="drf-arrow" aria-hidden="true">&#8594;</span>

      {/* To date button */}
      <div className="drf-field-wrap">
        <label className="drf-label">To</label>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={`drf-date-btn${toOpen ? ' drf-date-btn--open' : ''}`}
            onClick={() => { setToOpen(o => !o); setFromOpen(false) }}
            aria-haspopup="dialog"
            aria-expanded={toOpen}
          >
            <DashIcon name="calendar" size={14} />
            <span>{to ? fmtDateDisplay(to) : 'Select date'}</span>
          </button>
          {toOpen && (
            <DatePopover
              label="To date"
              value={to}
              min={from || undefined}
              onSelect={v => { handleTo(v); setToOpen(false) }}
              onClose={closeTo}
            />
          )}
        </div>
      </div>

      {/* Garage dropdown */}
      <div className="drf-field-wrap">
        <label className="drf-label">Garage</label>
        <div className="drf-select-wrap">
          <DashIcon name="building" size={14} className="drf-select-icon" />
          <select
            className="drf-select"
            value={garageId || ''}
            onChange={e => onChange({ ...value, garageId: e.target.value })}
          >
            <option value="">All garages</option>
            {(garages || []).map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="drf-actions">
        <button
          type="button"
          className="adash-btn adash-btn--primary"
          onClick={() => onApply(value)}
          disabled={!isValid}
        >Apply</button>
        <button
          type="button"
          className="adash-btn adash-btn--ghost"
          onClick={onReset}
        >Reset</button>
      </div>
    </div>
  )
}
