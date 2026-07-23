/**
 * Pure timeline utilities shared by booking cards and the detail modal.
 * Both surfaces must call getHistoryTimelineItems() with the same three
 * arguments so they always produce identical output.
 */

export const getInspectionByType = (inspections, type) =>
  Array.isArray(inspections)
    ? inspections.find((item) => String(item?.type || '').toUpperCase() === type)
    : null

/**
 * Phases that prove intake has already occurred.
 * Any booking whose operationPhase is past WAITING_FOR_INTAKE must have
 * completed intake even if the BEFORE_WASH inspection record is unavailable
 * (e.g. still loading, or legacy data).
 */
const PAST_INTAKE_PHASES = [
  'AUTOMATED_WASH',
  'WAITING_FOR_CARE',
  'VEHICLE_CARE',
  'FINAL_INSPECTION',
  'READY_FOR_HANDOVER',
  'DONE',
]

const WASH_PHASES   = [...PAST_INTAKE_PHASES]
const CARE_PHASES   = ['VEHICLE_CARE', 'FINAL_INSPECTION', 'READY_FOR_HANDOVER', 'DONE']
const FINAL_PHASES  = ['FINAL_INSPECTION', 'READY_FOR_HANDOVER', 'DONE']

/**
 * Build the ordered timeline node list for a booking.
 *
 * @param {object}   booking      - booking summary or detail object
 * @param {Array}    serviceSteps - booking service step records (may be empty)
 * @param {Array}    inspections  - vehicle inspection records for this booking
 * @returns {Array<{label, active, time, danger?}>}
 */
export const getHistoryTimelineItems = (booking, serviceSteps = [], inspections = []) => {
  const status         = String(booking?.status || '').toUpperCase()
  const paymentStatus  = String(booking?.paymentStatus || '').toUpperCase()
  const checkedInAt    = booking?.checkedInAt
  const operationPhase = String(booking?.operationPhase || '').toUpperCase()

  if (status === 'NO_SHOW') {
    return [
      { label: 'Booked',  active: true, time: booking?.startTime },
      { label: 'No Show', active: true, danger: true, time: booking?.updatedAt || booking?.startTime },
    ]
  }

  if (status === 'CANCELED' || status === 'CANCELLED') {
    return [
      { label: 'Booked',    active: true, time: booking?.startTime },
      { label: 'Cancelled', active: true, danger: true, time: booking?.updatedAt || booking?.startTime },
    ]
  }

  const checkinActive = ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(status) || Boolean(checkedInAt)

  const beforeWashInspection = getInspectionByType(inspections, 'BEFORE_WASH')
  const afterWashInspection  = getInspectionByType(inspections, 'AFTER_WASH')

  // Intake is active when:
  //   (a) a BEFORE_WASH inspection record exists, OR
  //   (b) operationPhase proves we are already past intake, OR
  //   (c) booking has reached terminal status COMPLETED
  //       (supports legacy data where the inspection record may be missing)
  // CANCELED / NO_SHOW are handled above and never reach this point.
  const inspectionActive =
    Boolean(beforeWashInspection) ||
    PAST_INTAKE_PHASES.includes(operationPhase) ||
    status === 'COMPLETED'

  const requiresCare     = Boolean(booking?.requiresCareStaff) || Boolean(booking?.plannedCareStartAt)
  const washActive       = WASH_PHASES.includes(operationPhase) || status === 'COMPLETED'
  const careActive       = requiresCare && (CARE_PHASES.includes(operationPhase) || status === 'COMPLETED')
  const finalCheckActive = Boolean(afterWashInspection) || FINAL_PHASES.includes(operationPhase) || status === 'COMPLETED'
  const completedActive  = status === 'COMPLETED'

  const nodes = [
    { label: 'Booked',    active: true,           time: booking?.startTime },
    { label: 'Confirmed', active: status !== 'PENDING_DEPOSIT' && status !== 'CANCELED' && status !== 'CANCELLED', time: booking?.createdAt },
    { label: 'Check-in',  active: checkinActive,   time: checkedInAt },
    // time is only set when a real inspection record exists; fallbacks show "Not updated"
    { label: 'Intake',    active: inspectionActive, time: beforeWashInspection?.createdAt },
    { label: 'Wash',      active: washActive,       time: booking?.washBayStartTime },
  ]

  if (requiresCare) {
    nodes.push({ label: 'Care',        active: careActive,       time: booking?.careStartedAt })
    nodes.push({ label: 'Final Check', active: finalCheckActive, time: afterWashInspection?.createdAt || booking?.careCompletedAt })
  }

  nodes.push({ label: 'Completed', active: completedActive, time: booking?.completedAt })

  if (paymentStatus === 'PAID') {
    nodes.push({ label: 'Paid', active: true, time: booking?.paidAt })
  }

  return nodes
}
