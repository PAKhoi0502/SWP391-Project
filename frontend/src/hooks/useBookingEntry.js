import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useGuestBooking } from '../contexts/GuestBookingContext'

/**
 * Returns handleBookingEntry({ garageId?, servicePackageId? }):
 *   - authenticated CUSTOMER  → navigate /booking (with optional query params)
 *   - unauthenticated          → open GuestBookingModal
 *   - STAFF / ADMIN            → no-op (they have their own flows)
 */
export function useBookingEntry() {
  const { isAuthenticated, role } = useAuth()
  const { openGuestModal } = useGuestBooking()
  const navigate = useNavigate()

  return useCallback(
    ({ garageId = '', servicePackageId = '' } = {}) => {
      const r = String(role || '').toUpperCase()
      if (r === 'STAFF' || r === 'ADMIN') return
      if (isAuthenticated && r === 'CUSTOMER') {
        const params = new URLSearchParams()
        if (garageId) params.set('garageId', String(garageId))
        if (servicePackageId) params.set('servicePackageId', String(servicePackageId))
        const q = params.toString()
        navigate(q ? `/booking?${q}` : '/booking')
      } else {
        openGuestModal()
      }
    },
    [isAuthenticated, role, navigate, openGuestModal],
  )
}

// Pure function exported for tests — same decision logic without React hooks
export function getBookingAction({ isAuthenticated, role, garageId = '', servicePackageId = '' }) {
  const r = String(role || '').toUpperCase()
  if (r === 'STAFF' || r === 'ADMIN') return { type: 'none' }
  if (isAuthenticated && r === 'CUSTOMER') {
    const params = new URLSearchParams()
    if (garageId) params.set('garageId', String(garageId))
    if (servicePackageId) params.set('servicePackageId', String(servicePackageId))
    const q = params.toString()
    return { type: 'navigate', to: q ? `/booking?${q}` : '/booking' }
  }
  return { type: 'modal', garageId: garageId || '', servicePackageId: servicePackageId || '' }
}
