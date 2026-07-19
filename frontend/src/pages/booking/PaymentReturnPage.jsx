import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const ROLE_FALLBACK_PATH = {
  CUSTOMER: '/customer/booking-history',
  STAFF: '/staff/bookings',
  ADMIN: '/admin/bookings',
}

function PaymentReturnPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { role } = useAuth()

  useEffect(() => {
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
      localStorage.setItem(`booking-payos-paid-${bookingId}`, new Date().toISOString())
      localStorage.setItem(`booking-payment-method-${bookingId}`, 'PAYOS')
    }

    localStorage.removeItem('payosReturnPath')
    sessionStorage.removeItem('payosReturnPath')
    if (orderCode) {
      localStorage.removeItem(`payosReturnPath-${orderCode}`)
      sessionStorage.removeItem(`payosReturnPath-${orderCode}`)
    }
    navigate(`${savedPath}?payment=${isSuccess ? 'success' : 'cancel'}`, { replace: true })
  }, [location.pathname, location.search, navigate, role])

  return (
    <div className="booking-history-page">
      <div className="booking-history-empty">Returning to your booking...</div>
    </div>
  )
}

export default PaymentReturnPage
