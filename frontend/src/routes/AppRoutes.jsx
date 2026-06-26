// Khai báo toàn bộ tuyến đường (routes) của ứng dụng.
//
// PublicLayout bọc trang công khai; Customer/Staff/AdminLayout bọc dashboard theo role.
import { Routes, Route } from 'react-router-dom'
import { ROLES } from '../constants/roles'
import AdminLayout from '../layouts/AdminLayout'
import CustomerLayout from '../layouts/CustomerLayout'
import PublicLayout from '../layouts/PublicLayout'
import StaffLayout from '../layouts/StaffLayout'
import ProtectedRoute from './ProtectedRoute'
import DashboardPlaceholderPage from '../pages/DashboardPlaceholderPage'
import ForbiddenPage from '../pages/ForbiddenPage'
import HomePage from '../pages/HomePage'
import LoginPage from '../pages/LoginPage'
import NotFoundPage from '../pages/NotFoundPage'
import UikitDemo from '../pages/UikitDemo'

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/uikit" element={<UikitDemo />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.CUSTOMER]} />}>
        <Route element={<CustomerLayout />}>
          <Route path="/customer" element={<DashboardPlaceholderPage title="Customer Dashboard" />} />
          <Route path="/customer/bookings" element={<DashboardPlaceholderPage title="Lịch hẹn khách hàng" />} />
          <Route path="/customer/profile" element={<DashboardPlaceholderPage title="Hồ sơ khách hàng" />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.STAFF]} />}>
        <Route element={<StaffLayout />}>
          <Route path="/staff" element={<DashboardPlaceholderPage title="Staff Dashboard" />} />
          <Route path="/staff/bookings" element={<DashboardPlaceholderPage title="Booking cần xử lý" />} />
          <Route path="/staff/inspections" element={<DashboardPlaceholderPage title="Kiểm tra xe" />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<DashboardPlaceholderPage title="Admin Dashboard" />} />
          <Route path="/admin/users" element={<DashboardPlaceholderPage title="Quản lý người dùng" />} />
          <Route path="/admin/garages" element={<DashboardPlaceholderPage title="Quản lý garage" />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRoutes
