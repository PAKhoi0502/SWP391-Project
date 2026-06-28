import { Routes, Route, Navigate } from 'react-router-dom'
import { ROLES } from '../constants/roles'
import AdminLayout from '../layouts/AdminLayout'
import CustomerLayout from '../layouts/CustomerLayout'
import PublicLayout from '../layouts/PublicLayout'
import StaffLayout from '../layouts/StaffLayout'
import AdminUsersPage from '../pages/AdminUsersPage'
import AdminStaffProfilesPage from '../pages/AdminStaffProfilesPage'
import ProtectedRoute from './ProtectedRoute'
import DashboardPlaceholderPage from '../pages/DashboardPlaceholderPage'
import ForbiddenPage from '../pages/ForbiddenPage'
import ForgotPasswordPage from '../pages/ForgotPasswordPage'
import HomePage from '../pages/HomePage'
import LoginPage from '../pages/LoginPage'
import NotFoundPage from '../pages/NotFoundPage'
import ProfilePage from '../pages/ProfilePage'
import RegisterPage from '../pages/RegisterPage'
import ResetPasswordPage from '../pages/ResetPasswordPage'
import StaffProfilePage from '../pages/StaffProfilePage'
import UikitDemo from '../pages/UikitDemo'
import GarageListPage from '../pages/GarageListPage'
import GarageDetailPage from '../pages/GarageDetailPage'
import AdminGarageListPage from '../pages/admin/AdminGarageListPage'
import AdminGarageFormPage from '../pages/admin/AdminGarageFormPage'
import AdminWashBayManagementPage from '../pages/admin/AdminWashBayManagementPage'
import AdminVehiclesPage from '../pages/admin/AdminVehiclesPage'
import CustomerVehiclesPage from '../pages/CustomerVehiclesPage'
import ServicePackageListPage from '../pages/ServicePackageListPage'
import ServicePackageDetailPage from '../pages/ServicePackageDetailPage'
import AdminServicePackagePage from '../pages/admin/AdminServicePackagePage'
import AvailableSlotsPickerPage from '../pages/booking/AvailableSlotsPickerPage'
import CustomerWaitlistPage from '../pages/booking/CustomerWaitlistPage'
import WaitlistPage from '../pages/booking/WaitlistPage'


function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="uikit" element={<UikitDemo />} />
        <Route path="forbidden" element={<ForbiddenPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.CUSTOMER]} />}>
        <Route element={<CustomerLayout />}>
          <Route path="customer" element={<Navigate to="/" replace />} />
          <Route path="customer/bookings" element={<DashboardPlaceholderPage title="Lich hen khach hang" />} />
          <Route path="customer/waitlist" element={<CustomerWaitlistPage />} />
          <Route path="customer/vehicles" element={<CustomerVehiclesPage />} />
          <Route path="customer/profile" element={<ProfilePage />} />
          <Route path="customer/vehicles" element={<CustomerVehiclesPage />} />
          <Route path="customer/garages" element={<GarageListPage />} />
          <Route path="customer/garages/:id" element={<GarageDetailPage />} />
          <Route path="customer/service-packages" element={<ServicePackageListPage />} />
          <Route path="customer/service-packages/:id" element={<ServicePackageDetailPage />} />
          <Route path="/booking" element={<AvailableSlotsPickerPage />} />
          <Route path="/waitlist" element={<WaitlistPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.STAFF]} />}>
        <Route element={<StaffLayout />}>
          <Route path="staff" element={<DashboardPlaceholderPage title="Staff Dashboard" />} />
          <Route path="staff/bookings" element={<DashboardPlaceholderPage title="Booking can xu ly" />} />
          <Route path="staff/inspections" element={<DashboardPlaceholderPage title="Kiem tra xe" />} />
          <Route path="staff/profile" element={<StaffProfilePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
        <Route element={<AdminLayout />}>
          <Route path="admin" element={<DashboardPlaceholderPage title="Admin Dashboard" />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/staff-profiles" element={<AdminStaffProfilesPage />} />
          <Route path="admin/vehicles" element={<AdminVehiclesPage />} />
          <Route path="admin/garages" element={<AdminGarageListPage />} />
          <Route path="admin/garages/create" element={<AdminGarageFormPage />} />
          <Route path="admin/garages/:id" element={<GarageDetailPage />} />
          <Route path="admin/garages/:id/edit" element={<AdminGarageFormPage />} />
          <Route path="admin/wash-bays" element={<AdminWashBayManagementPage />} />
          <Route path="admin/service-packages" element={<AdminServicePackagePage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRoutes
