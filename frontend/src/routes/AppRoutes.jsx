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
import CustomerCreateBookingPage from '../pages/booking/CustomerCreateBookingPage'
import WaitlistPage from '../pages/booking/WaitlistPage'
import StaffWaitlistPage from '../pages/booking/StaffWaitlistPage'
import BookingHistoryPage from '../pages/booking/BookingHistoryPage'
import CustomerBookingListPage from '../pages/booking/CustomerBookingListPage'
import BookingDetailPage from '../pages/booking/BookingDetailPage'
import StaffBookingListPage from '../pages/booking/StaffBookingListPage'
import StaffWalkInBookingPage from '../pages/booking/StaffWalkInBookingPage'
import AdminBookingListPage from '../pages/booking/AdminBookingListPage'
import PaymentReturnPage from '../pages/booking/PaymentReturnPage'
import CustomerWashHistoryListPage from '../pages/washHistory/CustomerWashHistoryListPage'
import WashHistoryDetailPage from '../pages/washHistory/WashHistoryDetailPage'
import AdminWashHistoryListPage from '../pages/washHistory/AdminWashHistoryListPage'
import AdminTierRulesPage from '../pages/loyalty/AdminTierRulesPage'
import AdminPromotionManagementPage from '../pages/admin/AdminPromotionManagementPage'
import CustomerPromotionListPage from '../pages/promotion/CustomerPromotionListPage'
import CustomerPromotionDetailPage from '../pages/promotion/CustomerPromotionDetailPage'


function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="payment/success" element={<PaymentReturnPage />} />
        <Route path="payment/cancel" element={<PaymentReturnPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="uikit" element={<UikitDemo />} />
        <Route path="forbidden" element={<ForbiddenPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.CUSTOMER]} />}>
        <Route element={<CustomerLayout />}>
          <Route path="customer" element={<Navigate to="/" replace />} />
          <Route path="customer/vehicles" element={<CustomerVehiclesPage />} />
          <Route path="customer/profile" element={<ProfilePage />} />
          <Route path="customer/garages" element={<GarageListPage />} />
          <Route path="customer/garages/:id" element={<GarageDetailPage />} />
          <Route path="customer/service-packages" element={<ServicePackageListPage />} />
          <Route path="customer/service-packages/:id" element={<ServicePackageDetailPage />} />
          <Route path="/booking" element={<CustomerCreateBookingPage />} />
          <Route path="/booking/available-slots" element={<AvailableSlotsPickerPage />} />
          <Route path="/customer/waitlist" element={<WaitlistPage />} />
          <Route path="/customer/bookings" element={<CustomerBookingListPage />} />
          <Route path="/customer/bookings/:id" element={<BookingDetailPage />} />
          <Route path="/customer/booking-history" element={<BookingHistoryPage />} />
          <Route path="/customer/wash-histories" element={<CustomerWashHistoryListPage />} />
          <Route path="/customer/wash-histories/:id" element={<WashHistoryDetailPage />} />
          <Route path="/customer/promotions" element={<CustomerPromotionListPage />} />
          <Route path="/customer/promotions/:id" element={<CustomerPromotionDetailPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.STAFF]} />}>
        <Route element={<StaffLayout />}>
          <Route path="staff" element={<DashboardPlaceholderPage title="Staff Dashboard" />} />
          <Route path="staff/bookings" element={<StaffBookingListPage />} />
          <Route path="staff/bookings/walk-in" element={<StaffWalkInBookingPage />} />
          <Route path="staff/bookings/:id" element={<BookingDetailPage />} />
          <Route path="staff/inspections" element={<Navigate to="/staff/bookings" replace />} />
          <Route path="staff/profile" element={<StaffProfilePage />} />
          <Route path="staff/waitlist" element={<StaffWaitlistPage />} />
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
          <Route path="admin/bookings" element={<AdminBookingListPage />} />
          <Route path="admin/bookings/:id" element={<BookingDetailPage />} />
          <Route path="admin/wash-histories" element={<AdminWashHistoryListPage />} />
          <Route path="admin/waitlist" element={<StaffWaitlistPage />} />
          <Route path="admin/loyalty/tier-rules" element={<AdminTierRulesPage />} />
          <Route path="admin/promotions" element={<AdminPromotionManagementPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRoutes
