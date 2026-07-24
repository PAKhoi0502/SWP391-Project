import { createContext, useContext, useEffect, useState } from 'react'
import { staffProfileService } from '../services/staffProfileService'

const StaffProfileContext = createContext({ profile: null, loading: true })

export function StaffProfileProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    staffProfileService.getMe()
      .then((data) => { if (!ignore) setProfile(data) })
      .catch(() => {})
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [])

  return (
    <StaffProfileContext.Provider value={{ profile, loading }}>
      {children}
    </StaffProfileContext.Provider>
  )
}

export const useStaffProfile = () => useContext(StaffProfileContext)
