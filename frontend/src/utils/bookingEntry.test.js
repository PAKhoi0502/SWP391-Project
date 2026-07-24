import { describe, it, expect } from 'vitest'
import { getBookingAction } from '../hooks/useBookingEntry'
import { computeActiveSteps, draftKey, isSignInRequired } from './guestBookingUtils'

// ── getBookingAction ──────────────────────────────────────────────────────────

describe('getBookingAction — unauthenticated guest', () => {
  it('returns modal action when not authenticated', () => {
    const result = getBookingAction({ isAuthenticated: false, role: '' })
    expect(result.type).toBe('modal')
  })

  it('passes garageId and servicePackageId through', () => {
    const result = getBookingAction({
      isAuthenticated: false,
      role: '',
      garageId: '3',
      servicePackageId: '7',
    })
    expect(result).toEqual({ type: 'modal', garageId: '3', servicePackageId: '7' })
  })

  it('defaults empty strings for missing ids', () => {
    const result = getBookingAction({ isAuthenticated: false, role: '' })
    expect(result.garageId).toBe('')
    expect(result.servicePackageId).toBe('')
  })
})

describe('getBookingAction — authenticated CUSTOMER', () => {
  it('returns navigate /booking when no preselection', () => {
    const result = getBookingAction({ isAuthenticated: true, role: 'CUSTOMER' })
    expect(result.type).toBe('navigate')
    expect(result.to).toBe('/booking')
  })

  it('appends garageId query param when provided', () => {
    const result = getBookingAction({
      isAuthenticated: true,
      role: 'CUSTOMER',
      garageId: '2',
    })
    expect(result.to).toBe('/booking?garageId=2')
  })

  it('appends both params when both provided', () => {
    const result = getBookingAction({
      isAuthenticated: true,
      role: 'CUSTOMER',
      garageId: '2',
      servicePackageId: '9',
    })
    expect(result.to).toBe('/booking?garageId=2&servicePackageId=9')
  })
})

describe('getBookingAction — STAFF / ADMIN', () => {
  it('returns none for STAFF', () => {
    const result = getBookingAction({ isAuthenticated: true, role: 'STAFF' })
    expect(result.type).toBe('none')
  })

  it('returns none for ADMIN', () => {
    const result = getBookingAction({ isAuthenticated: true, role: 'ADMIN' })
    expect(result.type).toBe('none')
  })

  it('is case-insensitive on role', () => {
    expect(getBookingAction({ isAuthenticated: true, role: 'staff' }).type).toBe('none')
    expect(getBookingAction({ isAuthenticated: true, role: 'admin' }).type).toBe('none')
  })
})

// ── computeActiveSteps ────────────────────────────────────────────────────────

describe('computeActiveSteps — no preselection (navbar path)', () => {
  it('returns all 5 steps when nothing is preselected', () => {
    expect(computeActiveSteps('', '')).toEqual(['info', 'garage', 'package', 'slot', 'review'])
  })

  it('treats null/undefined same as empty string', () => {
    expect(computeActiveSteps(null, null)).toEqual(['info', 'garage', 'package', 'slot', 'review'])
    expect(computeActiveSteps(undefined, undefined)).toEqual(['info', 'garage', 'package', 'slot', 'review'])
  })
})

describe('computeActiveSteps — with garage preselected', () => {
  it('skips garage step but keeps package step', () => {
    const steps = computeActiveSteps('1', '')
    expect(steps).not.toContain('garage')
    expect(steps).toContain('package')
    expect(steps).toEqual(['info', 'package', 'slot', 'review'])
  })
})

describe('computeActiveSteps — with both garage and package preselected', () => {
  it('skips both garage and package steps', () => {
    const steps = computeActiveSteps('1', '5')
    expect(steps).not.toContain('garage')
    expect(steps).not.toContain('package')
    expect(steps).toEqual(['info', 'slot', 'review'])
  })
})

// ── draftKey ──────────────────────────────────────────────────────────────────

describe('draftKey', () => {
  it('produces the correct key format', () => {
    expect(draftKey('1', '5')).toBe('guest-booking-draft:v1:1:5')
  })

  it('handles empty ids (navbar path)', () => {
    expect(draftKey('', '')).toBe('guest-booking-draft:v1::')
  })

  it('handles null/undefined gracefully', () => {
    expect(draftKey(null, null)).toBe('guest-booking-draft:v1::')
  })

  it('different contexts produce different keys', () => {
    expect(draftKey('1', '5')).not.toBe(draftKey('1', '6'))
    expect(draftKey('1', '5')).not.toBe(draftKey('2', '5'))
    expect(draftKey('', '')).not.toBe(draftKey('1', '5'))
  })
})

// ── isSignInRequired ──────────────────────────────────────────────────────────

describe('isSignInRequired', () => {
  it('returns true when message contains ACCOUNT_EXISTS_SIGN_IN_REQUIRED', () => {
    expect(isSignInRequired('ACCOUNT_EXISTS_SIGN_IN_REQUIRED')).toBe(true)
    expect(isSignInRequired('Error: ACCOUNT_EXISTS_SIGN_IN_REQUIRED')).toBe(true)
  })

  it('returns false for generic errors', () => {
    expect(isSignInRequired('Failed to create booking. Please try again.')).toBe(false)
    expect(isSignInRequired('Network error')).toBe(false)
    expect(isSignInRequired('')).toBe(false)
  })

  it('returns false for null/undefined', () => {
    expect(isSignInRequired(null)).toBe(false)
    expect(isSignInRequired(undefined)).toBe(false)
  })

  it('does NOT trigger on phone-not-found or other auth errors', () => {
    expect(isSignInRequired('UNAUTHORIZED')).toBe(false)
    expect(isSignInRequired('PHONE_NOT_FOUND')).toBe(false)
  })
})
