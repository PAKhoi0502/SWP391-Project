import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext'

function ProtectedRoute({ allowedRoles = [] }) {
  const { isAuthenticated, role, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        Checking authentication...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const normalizedRole = String(role || '').toUpperCase()

  const canAccess =
    allowedRoles.length === 0 ||
    allowedRoles.some((item) => String(item).toUpperCase() === normalizedRole)

  if (!canAccess) {
    return <Navigate to="/forbidden" replace />
  }

  return <Outlet />
}

export default ProtectedRoute