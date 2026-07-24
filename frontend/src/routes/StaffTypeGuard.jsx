import { Navigate, Outlet, useOutletContext } from 'react-router-dom'

export default function StaffTypeGuard() {
  const { staffType, staffTypeLoaded } = useOutletContext() || {}

  // Hold until staffType is resolved — never mount child routes prematurely.
  if (!staffTypeLoaded) return null

  // Explicit allow-list: only CUSTOMER_SERVICE_STAFF may enter these routes.
  // Any other value — VEHICLE_CARE_STAFF, SERVICE_ADVISOR, MANAGER, empty string,
  // null (load error), or unknown — is redirected away. This is fail-closed.
  if (staffType !== 'CUSTOMER_SERVICE_STAFF') {
    return <Navigate to="/staff" replace />
  }

  return <Outlet context={{ staffType, staffTypeLoaded }} />
}
