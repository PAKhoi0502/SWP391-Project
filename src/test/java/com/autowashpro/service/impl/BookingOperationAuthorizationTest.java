package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CompleteBookingServiceStepRequest;
import com.autowashpro.dto.request.MarkBookingPaidRequest;
import com.autowashpro.dto.request.ReopenBookingServiceStepRequest;
import com.autowashpro.dto.request.UpdatePaymentMethodRequest;
import com.autowashpro.dto.request.WalkInBookingCreateRequest;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.BookingServiceStep;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.repository.*;
import com.autowashpro.service.*;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.service.support.PackageResourceResolver;
import com.autowashpro.service.support.StaffOperationAccessPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingOperationAuthorizationTest {

    // ── repositories ─────────────────────────────────────────────────────────
    @Mock GarageRepository garageRepository;
    @Mock ServicePackageRepository servicePackageRepository;
    @Mock WashBayRepository washBayRepository;
    @Mock BookingRepository bookingRepository;
    @Mock PaymentTransactionRepository paymentTransactionRepository;
    @Mock VehicleRepository vehicleRepository;
    @Mock CustomerLoyaltyRepository customerLoyaltyRepository;
    @Mock LoyaltyTierRuleRepository loyaltyTierRuleRepository;
    @Mock PromotionRepository promotionRepository;
    @Mock PromotionUsageRepository promotionUsageRepository;
    @Mock BookingAssignedStaffRepository bookingAssignedStaffRepository;
    @Mock StaffProfileRepository staffProfileRepository;
    @Mock UserRepository userRepository;
    @Mock BookingServiceStepRepository bookingServiceStepRepository;
    @Mock ServicePackageStepRepository servicePackageStepRepository;
    @Mock VehicleInspectionRepository vehicleInspectionRepository;
    @Mock BookingAddOnServicePackageRepository bookingAddOnServicePackageRepository;
    @Mock PointTransactionRepository pointTransactionRepository;

    // ── services ─────────────────────────────────────────────────────────────
    @Mock LoyaltyService loyaltyService;
    @Mock LoyaltyPointExpiryService loyaltyPointExpiryService;
    @Mock WashHistoryService washHistoryService;
    @Mock PromotionService promotionService;
    @Mock NotificationService notificationService;
    @Mock EmailService emailService;
    @Mock BookingReviewService bookingReviewService;
    @Mock ComboStepResolver comboStepResolver;

    // ── policy under test ────────────────────────────────────────────────────
    @Mock StaffOperationAccessPolicy staffOperationAccessPolicy;
    @Mock PackageResourceResolver packageResourceResolver;

    @InjectMocks
    BookingServiceImpl bookingService;

    @BeforeEach
    void setUp() {
        lenient().when(packageResourceResolver.resolveEffectivePackages(any()))
                .thenAnswer(inv -> List.of(inv.<ServicePackage>getArgument(0)));
        lenient().when(bookingAddOnServicePackageRepository.findByBookingIdOrderBySortOrderAsc(anyLong()))
                .thenReturn(List.of());
        lenient().when(bookingAssignedStaffRepository.findByBookingId(anyLong()))
                .thenReturn(List.of());
    }

    private static final Long GARAGE_ID = 10L;
    private static final Long BOOKING_ID = 100L;
    private static final Long STEP_ID = 200L;
    private static final Long STAFF_ID = 1L;

    private Booking confirmedBooking() {
        Booking b = new Booking();
        b.setId(BOOKING_ID);
        b.setGarageId(GARAGE_ID);
        b.setStatus("CONFIRMED");
        return b;
    }

    private Booking completedBooking() {
        Booking b = new Booking();
        b.setId(BOOKING_ID);
        b.setGarageId(GARAGE_ID);
        b.setStatus("COMPLETED");
        return b;
    }

    private BookingServiceStep inProgressStep() {
        BookingServiceStep step = new BookingServiceStep();
        step.setId(STEP_ID);
        step.setBookingId(BOOKING_ID);
        step.setStatus("PENDING");
        return step;
    }

    private BookingServiceStep completedStep() {
        BookingServiceStep step = new BookingServiceStep();
        step.setId(STEP_ID);
        step.setBookingId(BOOKING_ID);
        step.setStatus("COMPLETED");
        return step;
    }

    private void stubPolicyAllow(Long staffId, String role, Long garageId) {
        when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(staffId, role, garageId))
                .thenReturn(role.contains("ADMIN") ? null : new StaffProfile());
    }

    private void stubPolicyDeny(Long staffId, String role, Long garageId) {
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"))
                .when(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(staffId, role, garageId);
    }

    // ── createWalkInBooking ──────────────────────────────────────────────────

    @Nested
    class CreateWalkInBooking {

        @Test
        void vcs_throwsForbidden() {
            stubPolicyDeny(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            WalkInBookingCreateRequest req = new WalkInBookingCreateRequest();
            req.setGarageId(GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.createWalkInBooking(req, STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void inactiveCss_throwsForbidden() {
            stubPolicyDeny(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            WalkInBookingCreateRequest req = new WalkInBookingCreateRequest();
            req.setGarageId(GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.createWalkInBooking(req, STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void cssOtherGarage_throwsForbidden() {
            stubPolicyDeny(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            WalkInBookingCreateRequest req = new WalkInBookingCreateRequest();
            req.setGarageId(GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.createWalkInBooking(req, STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }
    }

    // ── markNoShow ───────────────────────────────────────────────────────────

    @Nested
    class MarkNoShow {

        @Test
        void css_callsPolicy() {
            Booking booking = confirmedBooking();
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking));
            stubPolicyAllow(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
            when(bookingAssignedStaffRepository.findByBookingId(BOOKING_ID)).thenReturn(java.util.List.of());
            when(bookingRepository.save(any())).thenReturn(booking);

            assertDoesNotThrow(() -> bookingService.markNoShow(BOOKING_ID, STAFF_ID, "ROLE_STAFF", null));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
        }

        @Test
        void vcs_throwsForbidden() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedBooking()));
            stubPolicyDeny(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.markNoShow(BOOKING_ID, STAFF_ID, "ROLE_STAFF", null));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void admin_callsPolicy() {
            Booking booking = confirmedBooking();
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID))
                    .thenReturn(null);
            when(bookingAssignedStaffRepository.findByBookingId(BOOKING_ID)).thenReturn(java.util.List.of());
            when(bookingRepository.save(any())).thenReturn(booking);

            assertDoesNotThrow(() -> bookingService.markNoShow(BOOKING_ID, STAFF_ID, "ROLE_ADMIN", null));
        }
    }

    // ── completeServiceStep ──────────────────────────────────────────────────

    @Nested
    class CompleteServiceStep {

        private final CompleteBookingServiceStepRequest stepReq = new CompleteBookingServiceStepRequest();

        @Test
        void css_callsPolicy() {
            BookingServiceStep step = inProgressStep();
            Booking booking = confirmedBooking();
            booking.setStatus("IN_PROGRESS");
            when(bookingServiceStepRepository.findById(STEP_ID)).thenReturn(Optional.of(step));
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking));
            stubPolicyAllow(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
            when(bookingServiceStepRepository.save(any())).thenReturn(step);

            assertDoesNotThrow(() -> bookingService.completeServiceStep(STEP_ID, STAFF_ID, "ROLE_STAFF", stepReq));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
        }

        @Test
        void vcs_throwsForbidden() {
            when(bookingServiceStepRepository.findById(STEP_ID)).thenReturn(Optional.of(inProgressStep()));
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedBooking()));
            stubPolicyDeny(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.completeServiceStep(STEP_ID, STAFF_ID, "ROLE_STAFF", stepReq));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void admin_callsPolicy() {
            BookingServiceStep step = inProgressStep();
            Booking booking = confirmedBooking();
            booking.setStatus("IN_PROGRESS");
            when(bookingServiceStepRepository.findById(STEP_ID)).thenReturn(Optional.of(step));
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID))
                    .thenReturn(null);
            when(bookingServiceStepRepository.save(any())).thenReturn(step);

            assertDoesNotThrow(() -> bookingService.completeServiceStep(STEP_ID, STAFF_ID, "ROLE_ADMIN", stepReq));
        }
    }

    // ── reopenServiceStep ────────────────────────────────────────────────────

    @Nested
    class ReopenServiceStep {

        private final ReopenBookingServiceStepRequest reopenReq = new ReopenBookingServiceStepRequest();

        @Test
        void vcs_throwsForbidden() {
            when(bookingServiceStepRepository.findById(STEP_ID)).thenReturn(Optional.of(completedStep()));
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedBooking()));
            stubPolicyDeny(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.reopenServiceStep(STEP_ID, STAFF_ID, "ROLE_STAFF", reopenReq));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void admin_callsPolicy() {
            BookingServiceStep step = completedStep();
            Booking booking = confirmedBooking();
            booking.setStatus("IN_PROGRESS");
            when(bookingServiceStepRepository.findById(STEP_ID)).thenReturn(Optional.of(step));
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID))
                    .thenReturn(null);
            when(bookingServiceStepRepository.save(any())).thenReturn(step);

            assertDoesNotThrow(() -> bookingService.reopenServiceStep(STEP_ID, STAFF_ID, "ROLE_ADMIN", reopenReq));
        }
    }

    // ── markBookingPaid ──────────────────────────────────────────────────────

    @Nested
    class MarkBookingPaid {

        @Test
        void css_callsPolicy() {
            Booking booking = completedBooking();
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking));
            stubPolicyAllow(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
            when(bookingRepository.save(any())).thenReturn(booking);
            doNothing().when(loyaltyService).updateBookingStatistics(any());
            doNothing().when(promotionService).recordPromotionUsageAfterPaidBooking(any());
            doNothing().when(loyaltyService).earnPointsAfterPaidBooking(any());
            doNothing().when(washHistoryService).createWashHistoryAfterPaidBooking(any());
            doNothing().when(notificationService).notifyPaymentAndReward(any());

            MarkBookingPaidRequest req = new MarkBookingPaidRequest();
            req.setPaymentMethod("CASH");

            assertDoesNotThrow(() -> bookingService.markBookingPaid(BOOKING_ID, STAFF_ID, "ROLE_STAFF", req));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
        }

        @Test
        void vcs_throwsForbidden() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(completedBooking()));
            stubPolicyDeny(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.markBookingPaid(BOOKING_ID, STAFF_ID, "ROLE_STAFF", new MarkBookingPaidRequest()));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void admin_callsPolicy() {
            Booking booking = completedBooking();
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID))
                    .thenReturn(null);
            when(bookingRepository.save(any())).thenReturn(booking);
            doNothing().when(loyaltyService).updateBookingStatistics(any());
            doNothing().when(promotionService).recordPromotionUsageAfterPaidBooking(any());
            doNothing().when(loyaltyService).earnPointsAfterPaidBooking(any());
            doNothing().when(washHistoryService).createWashHistoryAfterPaidBooking(any());
            doNothing().when(notificationService).notifyPaymentAndReward(any());

            MarkBookingPaidRequest req = new MarkBookingPaidRequest();
            req.setPaymentMethod("CASH");

            assertDoesNotThrow(() -> bookingService.markBookingPaid(BOOKING_ID, STAFF_ID, "ROLE_ADMIN", req));
        }
    }

    // ── lookupWalkInCustomerByPhone ──────────────────────────────────────────

    @Nested
    class LookupWalkInCustomerByPhone {

        @Test
        void admin_callsPolicy() {
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_ADMIN")).thenReturn(null);

            // phone=null → normalizePhone returns null → customer not found → returns found=false
            assertDoesNotThrow(() -> bookingService.lookupWalkInCustomerByPhone(null, null, STAFF_ID, "ROLE_ADMIN"));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_ADMIN");
        }

        @Test
        void css_callsPolicy() {
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_STAFF"))
                    .thenReturn(new StaffProfile());

            assertDoesNotThrow(() -> bookingService.lookupWalkInCustomerByPhone(null, null, STAFF_ID, "ROLE_STAFF"));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_STAFF");
        }

        @Test
        void vcs_throwsForbidden() {
            doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"))
                    .when(staffOperationAccessPolicy).requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_STAFF");

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.lookupWalkInCustomerByPhone("0123456789", null, STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }
    }

    // ── getPendingRefundBookings ─────────────────────────────────────────────

    @Nested
    class GetPendingRefundBookings {

        @Test
        void admin_returnsAll() {
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_ADMIN")).thenReturn(null);
            when(bookingRepository.findRefundPendingBookings()).thenReturn(java.util.List.of());

            assertDoesNotThrow(() -> bookingService.getPendingRefundBookings(STAFF_ID, "ROLE_ADMIN"));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_ADMIN");
        }

        @Test
        void css_callsPolicyAndFilters() {
            StaffProfile cssProfile = new StaffProfile();
            cssProfile.setStaffType(StaffType.CUSTOMER_SERVICE_STAFF);
            cssProfile.setIsActive(true);
            cssProfile.setGarageId(GARAGE_ID);
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_STAFF")).thenReturn(cssProfile);
            when(bookingRepository.findRefundPendingBookings()).thenReturn(java.util.List.of());

            assertDoesNotThrow(() -> bookingService.getPendingRefundBookings(STAFF_ID, "ROLE_STAFF"));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_STAFF");
        }

        @Test
        void vcs_throwsForbidden() {
            doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"))
                    .when(staffOperationAccessPolicy).requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_STAFF");

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.getPendingRefundBookings(STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            verify(bookingRepository, never()).findRefundPendingBookings();
        }

        @Test
        void manager_throwsForbidden() {
            doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"))
                    .when(staffOperationAccessPolicy).requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_STAFF");

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.getPendingRefundBookings(STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            verify(bookingRepository, never()).findRefundPendingBookings();
        }

        @Test
        void unknownRole_throwsForbidden() {
            doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"))
                    .when(staffOperationAccessPolicy).requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_UNKNOWN");

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.getPendingRefundBookings(STAFF_ID, "ROLE_UNKNOWN"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            verify(bookingRepository, never()).findRefundPendingBookings();
        }

        @Test
        void cssSameGarage_onlySeesOwnGarageBookings() {
            StaffProfile cssProfile = new StaffProfile();
            cssProfile.setGarageId(GARAGE_ID);
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_STAFF")).thenReturn(cssProfile);

            Booking sameGarage = new Booking();
            sameGarage.setId(1L);
            sameGarage.setGarageId(GARAGE_ID);

            Booking otherGarage = new Booking();
            otherGarage.setId(2L);
            otherGarage.setGarageId(99L);

            when(bookingRepository.findRefundPendingBookings())
                    .thenReturn(java.util.List.of(sameGarage, otherGarage));

            var result = bookingService.getPendingRefundBookings(STAFF_ID, "ROLE_STAFF");

            assertEquals(1, result.size());
        }
    }

    // ── completeManualRefund ─────────────────────────────────────────────────

    @Nested
    class CompleteManualRefund {

        @Test
        void registeredCustomer_mustUseDepositRefundWorkflow() {
            Booking booking = confirmedBooking();
            booking.setCustomerId(123L);
            booking.setDepositStatus("REFUND_PENDING");
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking));
            stubPolicyAllow(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.completeManualRefund(BOOKING_ID, STAFF_ID, "ROLE_STAFF", null));

            assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
            verify(bookingRepository, never()).save(any(Booking.class));
        }

        @Test
        void guestRefund_canStillBeCompletedManually() {
            Booking booking = confirmedBooking();
            booking.setCustomerId(null);
            booking.setDepositStatus("REFUND_PENDING");
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking));
            when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));
            stubPolicyAllow(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            var response = bookingService.completeManualRefund(
                    BOOKING_ID, STAFF_ID, "ROLE_STAFF", "Cash refund completed");

            assertEquals("REFUNDED", response.getDepositStatus());
            assertEquals("Cash refund completed", booking.getNote());
        }

        @Test
        void css_callsPolicy() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedBooking()));
            stubPolicyAllow(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            // After auth, booking.depositStatus is null → 400 BAD_REQUEST (not REFUND_PENDING)
            assertThrows(ResponseStatusException.class,
                    () -> bookingService.completeManualRefund(BOOKING_ID, STAFF_ID, "ROLE_STAFF", null));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
        }

        @Test
        void vcs_throwsForbidden() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedBooking()));
            stubPolicyDeny(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.completeManualRefund(BOOKING_ID, STAFF_ID, "ROLE_STAFF", null));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void admin_callsPolicy() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedBooking()));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID))
                    .thenReturn(null);

            assertThrows(ResponseStatusException.class,
                    () -> bookingService.completeManualRefund(BOOKING_ID, STAFF_ID, "ROLE_ADMIN", null));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID);
        }
    }

    // ── cancelBooking ────────────────────────────────────────────────────────

    @Nested
    class CancelBooking {

        @Test
        void unknownRole_throwsForbidden() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedBooking()));
            stubPolicyDeny(STAFF_ID, "ROLE_UNKNOWN", GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.cancelBooking(BOOKING_ID, STAFF_ID, "ROLE_UNKNOWN", "test"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void css_callsPolicy() {
            Booking booking = confirmedBooking();
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking));
            stubPolicyAllow(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
            when(bookingRepository.save(any())).thenReturn(booking);

            assertDoesNotThrow(() -> bookingService.cancelBooking(BOOKING_ID, STAFF_ID, "ROLE_STAFF", "reason"));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
        }

        @Test
        void vcs_throwsForbidden() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedBooking()));
            stubPolicyDeny(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.cancelBooking(BOOKING_ID, STAFF_ID, "ROLE_STAFF", "reason"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }
    }

    // ── completeService ──────────────────────────────────────────────────────

    @Nested
    class CompleteService {

        @Test
        void css_callsPolicy() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedBooking()));
            stubPolicyAllow(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            // After auth, booking status is CONFIRMED (not IN_PROGRESS) → 400 BAD_REQUEST
            assertThrows(ResponseStatusException.class,
                    () -> bookingService.completeService(BOOKING_ID, STAFF_ID, "ROLE_STAFF", null));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
        }

        @Test
        void vcs_throwsForbidden() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedBooking()));
            stubPolicyDeny(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.completeService(BOOKING_ID, STAFF_ID, "ROLE_STAFF", null));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void admin_callsPolicy() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedBooking()));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID))
                    .thenReturn(null);

            // After auth, booking status is CONFIRMED → 400
            assertThrows(ResponseStatusException.class,
                    () -> bookingService.completeService(BOOKING_ID, STAFF_ID, "ROLE_ADMIN", null));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID);
        }
    }

    // ── updatePaymentMethod ──────────────────────────────────────────────────

    @Nested
    class UpdatePaymentMethod {

        @Test
        void css_callsPolicy() {
            Booking booking = confirmedBooking();
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking));
            stubPolicyAllow(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
            when(bookingRepository.save(any())).thenReturn(booking);

            UpdatePaymentMethodRequest req = new UpdatePaymentMethodRequest();
            req.setPaymentMethod("CASH");

            assertDoesNotThrow(() -> bookingService.updatePaymentMethod(BOOKING_ID, STAFF_ID, "ROLE_STAFF", req));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
        }

        @Test
        void vcs_throwsForbidden() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(confirmedBooking()));
            stubPolicyDeny(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            UpdatePaymentMethodRequest req = new UpdatePaymentMethodRequest();
            req.setPaymentMethod("CASH");

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.updatePaymentMethod(BOOKING_ID, STAFF_ID, "ROLE_STAFF", req));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void admin_callsPolicy() {
            Booking booking = confirmedBooking();
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID))
                    .thenReturn(null);
            when(bookingRepository.save(any())).thenReturn(booking);

            UpdatePaymentMethodRequest req = new UpdatePaymentMethodRequest();
            req.setPaymentMethod("CASH");

            assertDoesNotThrow(() -> bookingService.updatePaymentMethod(BOOKING_ID, STAFF_ID, "ROLE_ADMIN", req));
        }
    }
}
