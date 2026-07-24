import { Navigate, Outlet } from 'react-router-dom'
import { useAuth, getRedirectPathByRole } from '../contexts/AuthContext'

/**
 * Allows the route only when the user is NOT authenticated.
 * While AuthContext is still resolving (loading=true), renders nothing to
 * avoid a one-frame flash of the login/register form before the redirect fires.
 * Redirects authenticated users to their role-appropriate home page.
 */
export default function GuestOnlyRoute() {
  const { loading, isAuthenticated, role } = useAuth()

  if (loading) return null

  if (isAuthenticated) {
    return <Navigate to={getRedirectPathByRole(role)} replace />
  }

  return <Outlet />
}
