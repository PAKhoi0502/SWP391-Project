import { useCallback, useEffect, useRef, useState } from 'react'
import './BookingErrorToast.css'

export function useBookingErrorToast() {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)
  const remainingRef = useRef(4500)
  const startRef = useRef(null)
  const pausedRef = useRef(false)

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = null
    setToast(null)
  }, [])

  const startTimer = useCallback((ms) => {
    clearTimeout(timerRef.current)
    startRef.current = Date.now()
    pausedRef.current = false
    timerRef.current = setTimeout(() => setToast(null), ms)
  }, [])

  const show = useCallback(
    ({ title, message }) => {
      remainingRef.current = 4500
      setToast({ title, message, key: Date.now() })
      startTimer(4500)
    },
    [startTimer],
  )

  const pause = useCallback(() => {
    if (pausedRef.current || !timerRef.current) return
    clearTimeout(timerRef.current)
    timerRef.current = null
    pausedRef.current = true
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - (startRef.current ?? Date.now())))
  }, [])

  const resume = useCallback(() => {
    if (!pausedRef.current || toast === null) return
    startTimer(remainingRef.current)
  }, [toast, startTimer])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return { toast, show, dismiss, pause, resume }
}

export default function BookingErrorToast({ toast, onDismiss, onMouseEnter, onMouseLeave }) {
  if (!toast) return null
  return (
    <div
      className="bk-err-toast"
      role="alert"
      aria-live="assertive"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="bk-err-toast-icon" aria-hidden="true">✕</span>
      <div className="bk-err-toast-body">
        <p className="bk-err-toast-title">{toast.title}</p>
        <p className="bk-err-toast-msg">{toast.message}</p>
      </div>
      <button
        className="bk-err-toast-close"
        onClick={onDismiss}
        aria-label="Dismiss error"
      >
        ×
      </button>
    </div>
  )
}
