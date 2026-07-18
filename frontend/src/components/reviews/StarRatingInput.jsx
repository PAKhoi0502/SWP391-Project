import { useState } from 'react'
import './StarRatingInput.css'

const STAR_COUNT = 5

export default function StarRatingInput({ value = 0, onChange, disabled = false }) {
  const [hovered, setHovered] = useState(0)

  const active = hovered > 0 ? hovered : value

  const handleClick = (n) => {
    if (!disabled) onChange(n)
  }

  const label = value === 0
    ? 'Click to rate'
    : `${value} out of ${STAR_COUNT} stars`

  return (
    <div className="sri-wrap" aria-label={label}>
      {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((n) => {
        const filled = n <= active
        const selected = n <= value
        return (
          <button
            key={n}
            type="button"
            className={[
              'sri-star',
              filled ? 'sri-star--filled' : '',
              selected && hovered === 0 ? 'sri-star--bounce' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => handleClick(n)}
            onMouseEnter={() => { if (!disabled) setHovered(n) }}
            onMouseLeave={() => setHovered(0)}
            disabled={disabled}
            aria-label={`${n} star${n !== 1 ? 's' : ''}`}
          >
            <svg
              width="28" height="28" viewBox="0 0 24 24"
              fill={filled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        )
      })}
      <span className="sri-label">{label}</span>
    </div>
  )
}
