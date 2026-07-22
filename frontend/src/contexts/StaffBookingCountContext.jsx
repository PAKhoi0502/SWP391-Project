import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { bookingApi } from '../api/bookingApi'

const ACTIVE_STATUSES = new Set(['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'])
const POLL_MS = 60_000

const StaffBookingCountContext = createContext({ count: 0, refresh: () => {} })

export function StaffBookingCountProvider({ children, enabled }) {
  const [count, setCount] = useState(0)

  const fetchCount = useCallback(async () => {
    if (!enabled) return
    try {
      const bookings = await bookingApi.getStaffBookings()
      setCount(bookings.filter((b) => ACTIVE_STATUSES.has(String(b.status || '').toUpperCase())).length)
    } catch {
      // silently ignore — badge stays at last known value
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    fetchCount()
    const id = setInterval(fetchCount, POLL_MS)
    return () => clearInterval(id)
  }, [enabled, fetchCount])

  return (
    <StaffBookingCountContext.Provider value={{ count, refresh: enabled ? fetchCount : () => {} }}>
      {children}
    </StaffBookingCountContext.Provider>
  )
}

export const useStaffBookingCount = () => useContext(StaffBookingCountContext).count
export const useRefreshBookingCount = () => useContext(StaffBookingCountContext).refresh
