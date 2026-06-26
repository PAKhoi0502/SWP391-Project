import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function normalizeRole(role) {
  return String(role || "").toUpperCase();
}

function ProtectedRoute({ allowedRoles = [] }) {
  const location = useLocation();
  const { user, role, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        Đang kiểm tra đăng nhập...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles.length > 0) {
    const currentRole = normalizeRole(role);

    const canAccess = allowedRoles
      .map(normalizeRole)
      .some((allowedRole) => currentRole.includes(allowedRole));

    if (!canAccess) {
      return <Navigate to="/forbidden" replace />;
    }
  }

  return <Outlet />;
}

export default ProtectedRoute;