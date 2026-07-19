const PHONE_INPUT = /^[0-9+.()\s-]+$/
const LOCAL_MOBILE = /^0[35789]\d{8}$/
const INTERNATIONAL_MOBILE = /^\+84[35789]\d{8}$/
const PLATE_INPUT = /^[A-Za-z0-9.\s-]+$/
const CURRENT_CAR = /^\d{2}[A-Z]\d{5}$/
const CURRENT_BIKE = /^\d{2}[A-Z][A-Z0-9]\d{5}$/
const LEGACY_BIKE_SHORT = /^\d{2}[A-Z]\d{4}$/
const LEGACY_BIKE_LONG = /^\d{2}[A-Z][A-Z0-9]\d{4}$/

export function normalizeVietnameseMobile(value) {
  const input = String(value || '').trim()
  if (!input || !PHONE_INPUT.test(input)) return null

  const compact = input.replace(/[\s.()-]/g, '')
  if (LOCAL_MOBILE.test(compact)) return `+84${compact.slice(1)}`
  if (INTERNATIONAL_MOBILE.test(compact)) return compact
  return null
}

export function getVietnameseMobileError(value) {
  if (!String(value || '').trim()) return 'Phone number is required.'
  return normalizeVietnameseMobile(value)
    ? ''
    : 'Use a valid Vietnamese mobile number, such as 0912345678 or +84912345678.'
}

export function normalizeLicensePlate(value) {
  const input = String(value || '').trim()
  if (!input || !PLATE_INPUT.test(input)) return null
  return input.toUpperCase().replace(/[\s.-]/g, '')
}

export function getLicensePlateError(value, vehicleType) {
  const input = String(value || '').trim()
  if (!input) return 'License plate is required.'
  if (!PLATE_INPUT.test(input)) return 'License plate contains unsupported characters.'

  const normalized = normalizeLicensePlate(input)
  const type = String(vehicleType || '').trim().toUpperCase()
  if (type === 'CAR') {
    return CURRENT_CAR.test(normalized)
      ? ''
      : 'Car license plate must contain 8 characters, such as 51G-123.45.'
  }
  if (type === 'BIKE' || type === 'MOTORBIKE' || type === 'MOTORCYCLE') {
    return CURRENT_BIKE.test(normalized)
      || LEGACY_BIKE_SHORT.test(normalized)
      || LEGACY_BIKE_LONG.test(normalized)
      ? ''
      : 'Motorbike license plate must contain 9 characters, or 7-8 for legacy plates.'
  }
  return 'Vehicle type must be CAR or BIKE.'
}
