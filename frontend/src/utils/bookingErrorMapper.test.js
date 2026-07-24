import { describe, it, expect } from 'vitest'
import { normalizeBookingError } from './bookingErrorMapper'

function apiError(message, status = 400) {
  return { response: { status, data: { message } } }
}

function networkError(message) {
  return { message }
}

describe('normalizeBookingError — BOOKING_LIMIT_REACHED', () => {
  it('formats tier and limit from message', () => {
    const err = apiError('BOOKING_LIMIT_REACHED: Exceeded maximum active bookings limit of 1 for tier BRONZE')
    const { title, message } = normalizeBookingError(err)
    expect(title).toBe('Booking limit reached')
    expect(message).toContain('BRONZE tier')
    expect(message).toContain('1 booking')
  })

  it('handles SILVER tier', () => {
    const err = apiError('BOOKING_LIMIT_REACHED: Exceeded maximum active bookings limit of 2 for tier SILVER')
    const { message } = normalizeBookingError(err)
    expect(message).toContain('SILVER tier')
    expect(message).toContain('2 bookings')
  })

  it('handles GOLD tier', () => {
    const err = apiError('BOOKING_LIMIT_REACHED: Exceeded maximum active bookings limit of 3 for tier GOLD')
    const { message } = normalizeBookingError(err)
    expect(message).toContain('GOLD tier')
  })

  it('handles PLATINUM tier', () => {
    const err = apiError('BOOKING_LIMIT_REACHED: Exceeded maximum active bookings limit of 5 for tier PLATINUM')
    const { message } = normalizeBookingError(err)
    expect(message).toContain('PLATINUM tier')
  })
})

describe('normalizeBookingError — slot / vehicle conflicts', () => {
  it('matches SLOT_NO_LONGER_AVAILABLE code', () => {
    const err = apiError('SLOT_NO_LONGER_AVAILABLE: The slot is taken')
    const { title } = normalizeBookingError(err)
    expect(title).toBe('Time slot no longer available')
  })

  it('matches vehicle already has active booking (no time conflict phrase)', () => {
    const err = apiError('Vehicle already has an active booking')
    const { title } = normalizeBookingError(err)
    expect(title).toBe('Vehicle already has an active booking')
  })

  it('matches vehicle booking during this time', () => {
    const err = apiError('Vehicle already has an active booking during this time')
    const { title } = normalizeBookingError(err)
    expect(title).toBe('Scheduling conflict')
  })

  it('matches customer already has booking at same garage', () => {
    const err = apiError('Customer already has booking at the same garage and time')
    const { title } = normalizeBookingError(err)
    expect(title).toBe('Duplicate booking at this garage')
  })
})

describe('normalizeBookingError — staff / time / garage', () => {
  it('matches not enough care staff', () => {
    const err = apiError('Not enough care staff available for this time slot')
    const { title } = normalizeBookingError(err)
    expect(title).toBe('No staff available')
  })

  it('matches online booking 15 minutes rule', () => {
    const err = apiError('Online bookings must be made at least 15 minutes in advance')
    const { title } = normalizeBookingError(err)
    expect(title).toBe('Booking too close to appointment time')
  })

  it('matches booking date exceeds window', () => {
    const err = apiError('Booking date exceeds allowed window of 7 days')
    const { title } = normalizeBookingError(err)
    expect(title).toBe('Date out of range')
  })

  it('matches garage does not support vehicle type', () => {
    const err = apiError('Garage does not support vehicle type TRUCK')
    const { title } = normalizeBookingError(err)
    expect(title).toBe('Vehicle type not supported')
  })

  it('matches PACKAGE_NOT_AVAILABLE_AT_GARAGE code', () => {
    const err = apiError('PACKAGE_NOT_AVAILABLE_AT_GARAGE: Package X not at garage Y')
    const { title } = normalizeBookingError(err)
    expect(title).toBe('Package not available at this garage')
  })
})

describe('normalizeBookingError — loyalty / promo / package type', () => {
  it('matches insufficient loyalty points', () => {
    const err = apiError('Insufficient loyalty points')
    const { title } = normalizeBookingError(err)
    expect(title).toBe('Insufficient loyalty points')
  })

  it('matches promotion related error', () => {
    const err = apiError('Promo code is no longer valid')
    const { title } = normalizeBookingError(err)
    expect(title).toBe('Promo code invalid')
  })

  it('matches inactive garage/package/vehicle error', () => {
    const err = apiError('The selected garage is currently inactive')
    const { title } = normalizeBookingError(err)
    expect(title).toBe('Service unavailable')
  })
})

describe('normalizeBookingError — http status fallbacks', () => {
  it('returns connection error on 503', () => {
    const err = { response: { status: 503, data: {} }, message: '' }
    const { title } = normalizeBookingError(err)
    expect(title).toBe('Cannot connect to server')
  })

  it('returns session expired on 401', () => {
    const err = { response: { status: 401, data: {} }, message: '' }
    const { title } = normalizeBookingError(err)
    expect(title).toBe('Session expired')
  })

  it('returns generic fallback for unknown message', () => {
    const err = networkError('Something went very wrong')
    const { title } = normalizeBookingError(err)
    expect(title).toBe('Booking failed')
  })

  it('returns generic fallback for empty error', () => {
    const { title } = normalizeBookingError({})
    expect(title).toBe('Booking failed')
  })
})
