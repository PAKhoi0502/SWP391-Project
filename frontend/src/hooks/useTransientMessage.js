import { useEffect, useRef, useState } from 'react'

/**
 * Hook for success/info messages that auto-clear after a duration.
 * DO NOT use for error messages — errors should stay until the user dismisses them.
 *
 * @param {number} duration - Auto-clear delay in milliseconds (default 7000)
 * @returns {[string, function]} - [message, setMessage]
 */
export function useTransientMessage(duration = 7000) {
  const [message, setMessageRaw] = useState('')
  const timerRef = useRef(null)

  const setMessage = (msg) => {
    // Clear any existing timer before scheduling the next one
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    setMessageRaw(msg)

    if (msg) {
      timerRef.current = setTimeout(() => {
        setMessageRaw('')
        timerRef.current = null
      }, duration)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return [message, setMessage]
}
