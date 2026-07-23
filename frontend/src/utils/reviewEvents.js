const EVENT_NAME = 'audela:reviewCreated'

/**
 * Emit after a review is successfully created.
 * Call this immediately after the API call succeeds — before any success timer.
 */
export function emitReviewCreated() {
  document.dispatchEvent(new CustomEvent(EVENT_NAME))
}

/**
 * Subscribe to review-created events.
 * Returns a cleanup function that removes the listener.
 */
export function onReviewCreated(callback) {
  document.addEventListener(EVENT_NAME, callback)
  return () => document.removeEventListener(EVENT_NAME, callback)
}
