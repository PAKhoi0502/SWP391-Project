function extractPrefix(raw) {
  const idx = raw.indexOf(':')
  if (idx < 1) return ''
  return raw.slice(0, idx).trim()
}

const BY_CODE = {
  BOOKING_LIMIT_REACHED: (raw) => {
    const tier = raw.match(/tier (\w+)/i)?.[1]?.toUpperCase()
    const limit = raw.match(/limit of (\d+)/i)?.[1]
    const tierText = tier ? `${tier} tier` : 'your current tier'
    const limitText = limit ? `${limit} booking${limit === '1' ? '' : 's'}` : 'the allowed limit'
    return {
      title: 'Booking limit reached',
      message: `You have reached the maximum of ${limitText} for ${tierText}. Please complete or cancel an existing booking before creating a new one.`,
    }
  },
  SLOT_NO_LONGER_AVAILABLE: () => ({
    title: 'Time slot no longer available',
    message: 'This time slot was just taken by another customer. Please select a different time.',
  }),
  PACKAGE_NOT_AVAILABLE_AT_GARAGE: () => ({
    title: 'Package not available at this garage',
    message: 'The selected service package is not offered at this garage.',
  }),
}

const PATTERN_RULES = [
  {
    test: (m) => /already has an active booking/i.test(m) && !/during this time/i.test(m),
    entry: {
      title: 'Vehicle already has an active booking',
      message: 'This vehicle has an unfinished booking. Please complete or cancel it before booking again.',
    },
  },
  {
    test: (m) => /already has an active booking during this time/i.test(m),
    entry: {
      title: 'Scheduling conflict',
      message: 'This vehicle already has a booking at that time. Please choose a different time slot.',
    },
  },
  {
    test: (m) =>
      /already has (a )?booking at the same/i.test(m) || /customer already has booking/i.test(m),
    entry: {
      title: 'Duplicate booking at this garage',
      message: 'You already have a booking at this garage for the same time. Please choose a different slot.',
    },
  },
  {
    test: (m) =>
      /not enough care staff/i.test(m) ||
      /insufficient.*care staff/i.test(m) ||
      /no available care staff/i.test(m),
    entry: {
      title: 'No staff available',
      message: 'There are not enough care staff available for this time slot. Please choose a different time.',
    },
  },
  {
    test: (m) => /at least 15 minutes/i.test(m) || /online bookings must be made/i.test(m),
    entry: {
      title: 'Booking too close to appointment time',
      message: 'Online bookings must be made at least 15 minutes in advance. Please select a later time slot.',
    },
  },
  {
    test: (m) => /exceeds allowed window/i.test(m) || /booking date exceeds/i.test(m),
    entry: {
      title: 'Date out of range',
      message: 'The selected date is beyond the allowed booking window.',
    },
  },
  {
    test: (m) =>
      /does not support vehicle type/i.test(m) || /garage does not support/i.test(m),
    entry: {
      title: 'Vehicle type not supported',
      message: 'This garage does not service your vehicle type.',
    },
  },
  {
    test: (m) =>
      /not compatible with selected service package/i.test(m) ||
      /vehicle.*not compatible/i.test(m),
    entry: {
      title: 'Vehicle incompatible with package',
      message: 'Your vehicle type is not compatible with the selected service package.',
    },
  },
  {
    test: (m) =>
      /inactive/i.test(m) && (/garage/i.test(m) || /package/i.test(m) || /vehicle/i.test(m)),
    entry: {
      title: 'Service unavailable',
      message: 'The garage, service package, or vehicle you selected is currently inactive.',
    },
  },
  {
    test: (m) =>
      /must have service type MAIN/i.test(m) ||
      /main service package/i.test(m) ||
      /ADD_ON.*not allowed/i.test(m),
    entry: {
      title: 'Invalid package type',
      message: 'The main service package must be of type MAIN or COMBO.',
    },
  },
  {
    test: (m) =>
      /insufficient loyalty points/i.test(m) || /not enough.*loyalty/i.test(m),
    entry: {
      title: 'Insufficient loyalty points',
      message: 'You no longer have enough loyalty points to apply. Your point balance may have changed.',
    },
  },
  {
    test: (m) => /promotion/i.test(m) || /promo code/i.test(m),
    entry: {
      title: 'Promo code invalid',
      message: 'This promo code is no longer valid or has reached its usage limit.',
    },
  },
]

function matchByPattern(raw) {
  for (const rule of PATTERN_RULES) {
    if (rule.test(raw)) return rule.entry
  }
  return null
}

function fallback(_raw, httpStatus) {
  if (httpStatus === 503 || httpStatus === 502) {
    return {
      title: 'Cannot connect to server',
      message: 'Unable to reach the server. Please check your connection and try again.',
    }
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      title: 'Session expired',
      message: 'Your session has expired. Please log in again.',
    }
  }
  return {
    title: 'Booking failed',
    message: 'Something went wrong. Please try again.',
  }
}

export function normalizeBookingError(error) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[booking error]', error)
  }
  const data = error?.response?.data
  const httpStatus = error?.response?.status
  const rawMessage = String(data?.message || error?.message || '')
  const prefix = extractPrefix(rawMessage)

  const codeHandler = BY_CODE[prefix]
  if (codeHandler) {
    return { code: prefix, ...codeHandler(rawMessage) }
  }

  const patternEntry = matchByPattern(rawMessage)
  if (patternEntry) {
    return { code: prefix || 'PATTERN_MATCH', ...patternEntry }
  }

  return { code: prefix || 'UNKNOWN', ...fallback(rawMessage, httpStatus) }
}
