import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const ROLE_FALLBACK_PATH = {
  CUSTOMER: '/customer/booking-history',
  STAFF: '/staff/bookings',
  ADMIN: '/admin/bookings',
}

// Purge all legacy booking-payos-paid-* keys left by the old payment cache logic.
// These keys are no longer written; cleaning them up prevents stale false-positive
// "PAID" statuses from appearing in the list pages.
const cleanupLegacyPayOSPaidKeys = () => {
  try {
    const keysToRemove = Object.keys(localStorage).filter((k) =>
      k.startsWith('booking-payos-paid-'),
    )
    keysToRemove.forEach((k) => localStorage.removeItem(k))
  } catch {
    // ignore storage errors
  }
}

function PaymentReturnPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { role } = useAuth()

  useEffect(() => {
    // Clean up all legacy booking-payos-paid-* cache keys on every PaymentReturnPage visit.
    cleanupLegacyPayOSPaidKeys()

    const fallbackPath = ROLE_FALLBACK_PATH[String(role || '').toUpperCase()] || '/'
    const params = new URLSearchParams(location.search)
    const orderCode = params.get('orderCode') || params.get('order_code')
    const savedPath =
      (orderCode ? sessionStorage.getItem(`payosReturnPath-${orderCode}`) : '') ||
      (orderCode ? localStorage.getItem(`payosReturnPath-${orderCode}`) : '') ||
      sessionStorage.getItem('payosReturnPath') ||
      localStorage.getItem('payosReturnPath') ||
      sessionStorage.getItem('payosLastReturnPath') ||
      localStorage.getItem('payosLastReturnPath') ||
      fallbackPath
    const isSuccess = location.pathname.includes('/success')
    const bookingId = savedPath.match(/bookings\/(\d+)/)?.[1]

    if (isSuccess && bookingId) {
      // Only cache the payment METHOD — do NOT cache a "paid" flag.
      // The booking-payos-paid-* localStorage pattern has been removed because it
      // incorrectly promoted deposit payments to full-payment status in list pages.
      // Payment status is now determined solely from backend transaction records.
      localStorage.setItem(`booking-payment-method-${bookingId}`, 'PAYOS')
    }

    localStorage.removeItem('payosReturnPath')
    sessionStorage.removeItem('payosReturnPath')
    if (orderCode) {
      localStorage.removeItem(`payosReturnPath-${orderCode}`)
      sessionStorage.removeItem(`payosReturnPath-${orderCode}`)
    }

    // Forward the orderCode to the booking detail page so it can verify the exact
    // transaction (DEPOSIT vs FINAL) and show the correct success message.
    const queryParams = new URLSearchParams()
    queryParams.set('payment', isSuccess ? 'success' : 'cancel')
    if (orderCode && isSuccess) {
      queryParams.set('orderCode', orderCode)
    }
    navigate(`${savedPath}?${queryParams.toString()}`, { replace: true })
  }, [location.pathname, location.search, navigate, role])

  return (
    <div className="booking-history-page">
      <div className="booking-history-empty">Returning to your booking...</div>
    </div>
  )
}

export default PaymentReturnPage
