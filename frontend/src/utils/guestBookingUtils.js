const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function draftKey(garageId, servicePackageId) {
  return `guest-booking-draft:v1:${garageId || ''}:${servicePackageId || ''}`
}

const ALL_STEPS = ['info', 'garage', 'package', 'slot', 'review']

export function computeActiveSteps(preselectedGarageId, preselectedServicePackageId) {
  return ALL_STEPS.filter((s) => {
    if (s === 'garage' && preselectedGarageId) return false
    if (s === 'package' && preselectedServicePackageId) return false
    return true
  })
}

export function isSignInRequired(errorMessage) {
  return String(errorMessage || '').includes('ACCOUNT_EXISTS_SIGN_IN_REQUIRED')
}

export function computeWashStepTotal(steps) {
  return (steps || [])
    .filter((s) => s.executionPhase === 'AUTOMATED_WASH' && String(s.name || '').trim())
    .reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0)
}

export { DRAFT_TTL_MS }
