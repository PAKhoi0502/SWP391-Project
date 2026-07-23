import { Routes, Route, Navigate } from 'react-router-dom'
import { ROLES } from '../constants/roles'
import AdminLayout from '../layouts/AdminLayout'
import CustomerLayout from '../layouts/CustomerLayout'
import PublicLayout from '../layouts/PublicLayout'
import StaffLayout from '../layouts/StaffLayout'
import AdminUsersPage from '../pages/AdminUsersPage'
import AdminStaffProfilesPage from '../pages/AdminStaffProfilesPage'
import ProtectedRoute from './ProtectedRoute'
import StaffTypeGuard from './StaffTypeGuard'
import DashboardPlaceholderPage from '../pages/DashboardPlaceholderPage'
import StaffDashboardPage from '../pages/staff/StaffDashboardPage'
import ForbiddenPage from '../pages/ForbiddenPage'
import ForgotPasswordPage from '../pages/ForgotPasswordPage'
import HomePage from '../pages/HomePage'
import LoginPage from '../pages/LoginPage'
import NotFoundPage from '../pages/NotFoundPage'
import ProfilePage from '../pages/ProfilePage'
import RegisterPage from '../pages/RegisterPage'
import AnimatedAuthShell from '../components/auth/AnimatedAuthShell'
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
import GuestBookingPage from '../pages/booking/GuestBookingPage'
import AdminBookingListPage from '../pages/booking/AdminBookingListPage'
import PaymentReturnPage from '../pages/booking/PaymentReturnPage'
import CustomerWashHistoryListPage from '../pages/washHistory/CustomerWashHistoryListPage'
import WashHistoryDetailPage from '../pages/washHistory/WashHistoryDetailPage'
import AdminWashHistoryListPage from '../pages/washHistory/AdminWashHistoryListPage'
import AdminTierRulesPage from '../pages/loyalty/AdminTierRulesPage'
import AdminAdjustPointsPage from '../pages/loyalty/AdminAdjustPointsPage'
import AdminPromotionManagementPage from '../pages/admin/AdminPromotionManagementPage'
import CustomerPromotionListPage from '../pages/promotion/CustomerPromotionListPage'
import CustomerPromotionDetailPage from '../pages/promotion/CustomerPromotionDetailPage'
import CustomerNotificationListPage from '../pages/notification/CustomerNotificationListPage'
import CustomerNotificationDetailPage from '../pages/notification/CustomerNotificationDetailPage'
import AdminTestEmailPage from '../pages/admin/AdminTestEmailPage'
import AdminDashboardPage from '../pages/admin/AdminDashboardPage'
import ProfileLayout from '../layouts/ProfileLayout'
import AboutUsPage from '../pages/AboutUsPage'
import AdminResearchExportPage from '../pages/admin/AdminResearchExportPage'
import AdminAuditLogPage from '../pages/admin/AdminAuditLogPage'
import AdminDepositRefundsPage from '../pages/admin/AdminDepositRefundsPage'
import AdminReviewsPage from '../pages/admin/AdminReviewsPage'
import CustomerLeaderboardPage from '../pages/leaderboard/CustomerLeaderboardPage'


function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutUsPage />} />
        <Route path="login" element={<AnimatedAuthShell />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="payment/success" element={<PaymentReturnPage />} />
        <Route path="payment/cancel" element={<PaymentReturnPage />} />
        <Route path="register" element={<AnimatedAuthShell />} />
        <Route path="uikit" element={<UikitDemo />} />
        <Route path="forbidden" element={<ForbiddenPage />} />
      </Route>

      {/* Customer standalone pages — ProfileLayout (no sidebar dashboard chrome) */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.CUSTOMER]} />}>
        <Route element={<ProfileLayout />}>
          <Route path="customer/profile" element={<ProfilePage />} />
          <Route path="/customer/booking-history" element={<BookingHistoryPage />} />
          <Route path="/booking" element={<CustomerCreateBookingPage />} />
          <Route path="/customer/bookings/:id" element={<BookingDetailPage />} />
          <Route path="/customer/notifications" element={<CustomerNotificationListPage />} />
          <Route path="/customer/notifications/:id" element={<CustomerNotificationDetailPage />} />
          <Route path="/customer/waitlist" element={<WaitlistPage />} />
          <Route path="/customer/leaderboard" element={<CustomerLeaderboardPage />} />
        </Route>
      </Route>

      {/* Service packages — public, no auth required; uses PublicPillNavbar via ProfileLayout */}
      <Route element={<ProfileLayout />}>
        <Route path="customer/service-packages" element={<ServicePackageListPage />} />
        <Route path="customer/service-packages/:id" element={<ServicePackageDetailPage />} />
        <Route path="guest-booking" element={<GuestBookingPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.CUSTOMER]} />}>
        <Route element={<CustomerLayout />}>
          <Route path="customer" element={<Navigate to="/" replace />} />
          <Route path="customer/vehicles" element={<CustomerVehiclesPage />} />
          <Route path="customer/garages" element={<GarageListPage />} />
          <Route path="customer/garages/:id" element={<GarageDetailPage />} />
          <Route path="/booking/available-slots" element={<AvailableSlotsPickerPage />} />
          <Route path="/customer/bookings" element={<CustomerBookingListPage />} />
          <Route path="/customer/wash-histories" element={<CustomerWashHistoryListPage />} />
          <Route path="/customer/wash-histories/:id" element={<WashHistoryDetailPage />} />
          <Route path="/customer/promotions" element={<CustomerPromotionListPage />} />
          <Route path="/customer/promotions/:id" element={<CustomerPromotionDetailPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.STAFF]} />}>
        <Route element={<StaffLayout />}>
          {/* Accessible by all staff types */}
          <Route path="staff" element={<StaffDashboardPage />} />
          <Route path="staff/profile" element={<StaffProfilePage />} />
          {/* CUSTOMER_SERVICE_STAFF only — VEHICLE_CARE_STAFF is redirected to /staff */}
          <Route element={<StaffTypeGuard />}>
            <Route path="staff/bookings" element={<StaffBookingListPage />} />
            <Route path="staff/bookings/walk-in" element={<StaffWalkInBookingPage />} />
            <Route path="staff/bookings/:id" element={<BookingDetailPage />} />
            <Route path="staff/waitlist" element={<StaffWaitlistPage />} />
          </Route>
          <Route path="staff/inspections" element={<Navigate to="/staff/bookings" replace />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
        <Route element={<AdminLayout />}>
          <Route path="admin" element={<AdminDashboardPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/staff-profiles" element={<AdminStaffProfilesPage />} />
          <Route path="admin/profile" element={<ProfilePage />} />
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
          <Route path="admin/loyalty/adjust-points" element={<AdminAdjustPointsPage />} />
          <Route path="admin/promotions" element={<AdminPromotionManagementPage />} />
          <Route path="admin/notifications/test-email" element={<AdminTestEmailPage />} />
          <Route path="admin/research/export" element={<AdminResearchExportPage />} />
          <Route path="admin/audit-logs" element={<AdminAuditLogPage />} />
          <Route path="admin/deposit-refunds" element={<AdminDepositRefundsPage />} />
          <Route path="admin/reviews" element={<AdminReviewsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRoutes
