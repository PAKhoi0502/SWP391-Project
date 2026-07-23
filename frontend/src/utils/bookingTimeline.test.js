import { describe, it, expect } from 'vitest'
import { getHistoryTimelineItems, getInspectionByType } from './bookingTimeline'

const makeBooking = (overrides = {}) => ({
  status: 'COMPLETED',
  paymentStatus: 'PAID',
  operationPhase: 'DONE',
  checkedInAt: '2024-01-01T09:00:00',
  startTime: '2024-01-01T08:00:00',
  createdAt: '2024-01-01T07:00:00',
  completedAt: '2024-01-01T11:00:00',
  paidAt: '2024-01-01T11:05:00',
  ...overrides,
})

const beforeWashInspection = { type: 'BEFORE_WASH', createdAt: '2024-01-01T09:10:00' }
const afterWashInspection  = { type: 'AFTER_WASH',  createdAt: '2024-01-01T10:30:00' }

const intakeNode = (items) => items.find((n) => n.label === 'Intake')

// ── 1. COMPLETED + has BEFORE_WASH ─────────────────────────────────────────
describe('COMPLETED booking with BEFORE_WASH inspection', () => {
  it('Intake is active with the inspection timestamp', () => {
    const booking = makeBooking()
    const items   = getHistoryTimelineItems(booking, [], [beforeWashInspection])
    const intake  = intakeNode(items)
    expect(intake.active).toBe(true)
    expect(intake.time).toBe(beforeWashInspection.createdAt)
  })

  it('card and modal produce identical items when given the same input', () => {
    const booking = makeBooking()
    const cardItems  = getHistoryTimelineItems(booking, [], [beforeWashInspection])
    const modalItems = getHistoryTimelineItems(booking, [], [beforeWashInspection])
    expect(cardItems).toEqual(modalItems)
  })
})

// ── 2. COMPLETED + no inspection (legacy data) ──────────────────────────────
describe('COMPLETED booking without inspection records (legacy)', () => {
  it('Intake is still active via terminal-status fallback', () => {
    const booking = makeBooking({ operationPhase: '' })
    const items   = getHistoryTimelineItems(booking, [], [])
    const intake  = intakeNode(items)
    expect(intake.active).toBe(true)
  })

  it('Intake has no fabricated timestamp — time is undefined', () => {
    const booking = makeBooking({ operationPhase: '' })
    const items   = getHistoryTimelineItems(booking, [], [])
    const intake  = intakeNode(items)
    expect(intake.time).toBeUndefined()
  })
})

// ── 3. IN_PROGRESS at AUTOMATED_WASH (inspection may still be loading) ─────
describe('IN_PROGRESS booking at AUTOMATED_WASH phase', () => {
  it('Intake is active via phase fallback even without inspection record', () => {
    const booking = makeBooking({
      status: 'IN_PROGRESS',
      operationPhase: 'AUTOMATED_WASH',
      paymentStatus: 'UNPAID',
      completedAt: null,
      paidAt: null,
    })
    const items  = getHistoryTimelineItems(booking, [], [])
    const intake = intakeNode(items)
    expect(intake.active).toBe(true)
  })
})

// ── 4. CHECKED_IN / WAITING_FOR_INTAKE, no BEFORE_WASH yet ─────────────────
describe('CHECKED_IN booking before intake has occurred', () => {
  it('Intake is NOT active', () => {
    const booking = makeBooking({
      status: 'CHECKED_IN',
      operationPhase: 'WAITING_FOR_INTAKE',
      paymentStatus: 'UNPAID',
      completedAt: null,
      paidAt: null,
    })
    const items  = getHistoryTimelineItems(booking, [], [])
    const intake = intakeNode(items)
    expect(intake.active).toBe(false)
  })
})

// ── 5. CANCELED before intake ───────────────────────────────────────────────
describe('CANCELED booking before intake', () => {
  it('returns only Booked and Cancelled nodes — no Intake node', () => {
    const booking = makeBooking({ status: 'CANCELED', operationPhase: '' })
    const items   = getHistoryTimelineItems(booking, [], [])
    const labels  = items.map((n) => n.label)
    expect(labels).toEqual(['Booked', 'Cancelled'])
    expect(labels).not.toContain('Intake')
  })

  it('NO_SHOW also returns only Booked and No Show nodes', () => {
    const booking = makeBooking({ status: 'NO_SHOW', operationPhase: '' })
    const items   = getHistoryTimelineItems(booking, [], [])
    const labels  = items.map((n) => n.label)
    expect(labels).toEqual(['Booked', 'No Show'])
    expect(labels).not.toContain('Intake')
  })
})

// ── 6. Booking with care service ────────────────────────────────────────────
describe('COMPLETED booking with care service', () => {
  it('includes Care and Final Check nodes, both active', () => {
    const booking = makeBooking({
      requiresCareStaff: true,
      careStartedAt: '2024-01-01T10:00:00',
      careCompletedAt: '2024-01-01T10:45:00',
    })
    const items  = getHistoryTimelineItems(booking, [], [beforeWashInspection, afterWashInspection])
    const labels = items.map((n) => n.label)
    expect(labels).toContain('Care')
    expect(labels).toContain('Final Check')
    expect(items.find((n) => n.label === 'Care').active).toBe(true)
    expect(items.find((n) => n.label === 'Final Check').active).toBe(true)
  })

  it('does NOT add Care/Final Check for non-care booking', () => {
    const booking = makeBooking({ requiresCareStaff: false })
    const items   = getHistoryTimelineItems(booking, [], [beforeWashInspection])
    const labels  = items.map((n) => n.label)
    expect(labels).not.toContain('Care')
    expect(labels).not.toContain('Final Check')
  })
})

// ── 7. Same input → same output (card vs modal contract) ────────────────────
describe('Timeline consistency guarantee', () => {
  it('card and modal are always identical when given same booking + inspections', () => {
    const booking = makeBooking({ operationPhase: 'DONE' })
    const inspections = [beforeWashInspection]
    const a = getHistoryTimelineItems(booking, [], inspections)
    const b = getHistoryTimelineItems(booking, [], inspections)
    expect(a).toEqual(b)
  })

  it('getInspectionByType is case-insensitive on type field', () => {
    const low = getInspectionByType([{ type: 'before_wash' }], 'BEFORE_WASH')
    expect(low).toBeDefined()
    const up = getInspectionByType([{ type: 'BEFORE_WASH' }], 'BEFORE_WASH')
    expect(up).toBeDefined()
  })
})
