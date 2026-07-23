import { createContext, useCallback, useContext, useRef, useState } from 'react'

const GuestBookingContext = createContext(null)

export function GuestBookingProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [preselection, setPreselection] = useState({ garageId: '', servicePackageId: '' })
  const triggerRef = useRef(null)

  const openGuestModal = useCallback(({ garageId = '', servicePackageId = '' } = {}) => {
    triggerRef.current = document.activeElement
    setPreselection({
      garageId: String(garageId || ''),
      servicePackageId: String(servicePackageId || ''),
    })
    setOpen(true)
  }, [])

  const closeGuestModal = useCallback(() => {
    setOpen(false)
    requestAnimationFrame(() => {
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus()
      }
    })
  }, [])

  return (
    <GuestBookingContext.Provider value={{ open, preselection, openGuestModal, closeGuestModal }}>
      {children}
    </GuestBookingContext.Provider>
  )
}

export function useGuestBooking() {
  const ctx = useContext(GuestBookingContext)
  if (!ctx) throw new Error('useGuestBooking must be used within GuestBookingProvider')
  return ctx
}
