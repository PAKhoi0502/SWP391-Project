import { describe, it, expect } from 'vitest'
import { computeWashStepTotal } from './guestBookingUtils'

// Helper to build a step object matching AdminServicePackagePage's step shape
const step = (phase, name, durationMinutes) => ({ executionPhase: phase, name, durationMinutes })

describe('computeWashStepTotal — Automated Wash window validation', () => {
  // ── Basic totals ───────────────────────────────────────────────────────────

  it('sums AUTOMATED_WASH step durations', () => {
    const steps = [
      step('AUTOMATED_WASH', 'Foam wash', 20),
      step('AUTOMATED_WASH', 'Rinse', 10),
    ]
    expect(computeWashStepTotal(steps)).toBe(30)
  })

  it('exactly 30 min is within limit (≤ 30)', () => {
    const steps = [step('AUTOMATED_WASH', 'Wash', 30)]
    expect(computeWashStepTotal(steps)).toBe(30)
    expect(computeWashStepTotal(steps)).not.toBeGreaterThan(30)
  })

  it('31 min exceeds limit (> 30)', () => {
    const steps = [step('AUTOMATED_WASH', 'Wash', 20), step('AUTOMATED_WASH', 'Detail', 11)]
    expect(computeWashStepTotal(steps)).toBe(31)
    expect(computeWashStepTotal(steps)).toBeGreaterThan(30)
  })

  // ── Care steps not included ────────────────────────────────────────────────

  it('ignores VEHICLE_CARE steps — care can exceed 30 min freely', () => {
    const steps = [
      step('AUTOMATED_WASH', 'Foam wash', 25),
      step('VEHICLE_CARE', 'Interior clean', 60),
    ]
    expect(computeWashStepTotal(steps)).toBe(25) // only wash counted
  })

  it('care-only package (0 wash steps) totals 0', () => {
    const steps = [step('VEHICLE_CARE', 'Polish', 60), step('VEHICLE_CARE', 'Wax', 45)]
    expect(computeWashStepTotal(steps)).toBe(0)
  })

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('returns 0 for empty steps', () => {
    expect(computeWashStepTotal([])).toBe(0)
  })

  it('returns 0 for null/undefined input', () => {
    expect(computeWashStepTotal(null)).toBe(0)
    expect(computeWashStepTotal(undefined)).toBe(0)
  })

  it('ignores steps with blank name (UI shows them but they are not submitted)', () => {
    const steps = [
      step('AUTOMATED_WASH', '', 20),   // blank name — AdminServicePackagePage filters these out
      step('AUTOMATED_WASH', 'Wash', 15),
    ]
    expect(computeWashStepTotal(steps)).toBe(15)
  })

  it('ignores steps with undefined/NaN duration', () => {
    const steps = [
      step('AUTOMATED_WASH', 'Wash', undefined),
      step('AUTOMATED_WASH', 'Rinse', 10),
    ]
    expect(computeWashStepTotal(steps)).toBe(10)
  })
})
