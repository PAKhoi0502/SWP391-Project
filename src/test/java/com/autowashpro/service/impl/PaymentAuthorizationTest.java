package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CreatePayOSPaymentRequest;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.PaymentTransaction;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.PaymentTransactionRepository;
import com.autowashpro.repository.PromotionRepository;
import com.autowashpro.repository.PromotionUsageRepository;
import com.autowashpro.service.AuditLogService;
import com.autowashpro.service.BookingService;
import com.autowashpro.service.EmailService;
import com.autowashpro.service.LoyaltyService;
import com.autowashpro.service.NotificationService;
import com.autowashpro.service.WashHistoryService;
import com.autowashpro.service.BookingReviewService;
import com.autowashpro.service.support.StaffOperationAccessPolicy;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentAuthorizationTest {

    @Mock BookingRepository bookingRepository;
    @Mock PaymentTransactionRepository transactionRepository;
    @Mock LoyaltyService loyaltyService;
    @Mock PromotionRepository promotionRepository;
    @Mock PromotionUsageRepository promotionUsageRepository;
    @Mock WashHistoryService washHistoryService;
    @Mock AuditLogService auditLogService;
    @Mock NotificationService notificationService;
    @Mock BookingReviewService bookingReviewService;
    @Mock EmailService emailService;
    @Mock PlatformTransactionManager transactionManager;
    @Mock BookingService bookingService;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @Mock org.springframework.web.client.RestTemplate restTemplate;
    @Mock vn.payos.PayOS payOS;
    @Mock StaffOperationAccessPolicy staffOperationAccessPolicy;

    @InjectMocks
    PaymentServiceImpl paymentService;

    private static final Long GARAGE_ID = 10L;
    private static final Long BOOKING_ID = 100L;
    private static final Long TX_ID = 200L;
    private static final Long STAFF_ID = 1L;

    private Booking booking(Long garageId) {
        Booking b = new Booking();
        b.setId(BOOKING_ID);
        b.setGarageId(garageId);
        return b;
    }

    private PaymentTransaction pendingTx(Long bookingId) {
        PaymentTransaction tx = new PaymentTransaction();
        tx.setId(TX_ID);
        tx.setBookingId(bookingId);
        tx.setStatus("PENDING");
        tx.setOrderCode(12345L);
        return tx;
    }

    // ── createPayOSPaymentForStaff ───────────────────────────────────────────

    @Nested
    class CreatePayOSPaymentForStaff {

        @Test
        void cssSameGarage_callsPolicy() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking(GARAGE_ID)));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID))
                    .thenReturn(new StaffProfile());

            CreatePayOSPaymentRequest request = new CreatePayOSPaymentRequest();
            request.setBookingId(BOOKING_ID);

            // After auth, the delegate call to createPayOSPayment will hit more logic; we just verify auth is invoked
            // (the delegate will fail without full PayOS wiring — we only test auth invocation here)
            try {
                paymentService.createPayOSPaymentForStaff(request, STAFF_ID, "ROLE_STAFF");
            } catch (Exception ignored) {
                // expected: PayOS call will fail in unit test; auth was already invoked
            }

            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
        }

        @Test
        void vcs_throwsForbidden() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking(GARAGE_ID)));
            doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"))
                    .when(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            CreatePayOSPaymentRequest request = new CreatePayOSPaymentRequest();
            request.setBookingId(BOOKING_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> paymentService.createPayOSPaymentForStaff(request, STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void admin_callsPolicyWithAdminRole() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking(GARAGE_ID)));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID))
                    .thenReturn(null);

            CreatePayOSPaymentRequest request = new CreatePayOSPaymentRequest();
            request.setBookingId(BOOKING_ID);

            try {
                paymentService.createPayOSPaymentForStaff(request, STAFF_ID, "ROLE_ADMIN");
            } catch (Exception ignored) {
                // expected after auth succeeds
            }

            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID);
        }
    }

    // ── getTransactionById ───────────────────────────────────────────────────

    @Nested
    class GetTransactionById {

        @Test
        void css_callsPolicy() {
            when(transactionRepository.findById(TX_ID)).thenReturn(Optional.of(pendingTx(BOOKING_ID)));
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking(GARAGE_ID)));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID))
                    .thenReturn(new StaffProfile());

            assertDoesNotThrow(() -> paymentService.getTransactionById(TX_ID, STAFF_ID, "ROLE_STAFF"));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
        }

        @Test
        void vcs_throwsForbidden() {
            when(transactionRepository.findById(TX_ID)).thenReturn(Optional.of(pendingTx(BOOKING_ID)));
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking(GARAGE_ID)));
            doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"))
                    .when(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> paymentService.getTransactionById(TX_ID, STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void admin_callsPolicy() {
            when(transactionRepository.findById(TX_ID)).thenReturn(Optional.of(pendingTx(BOOKING_ID)));
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking(GARAGE_ID)));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID))
                    .thenReturn(null);

            assertDoesNotThrow(() -> paymentService.getTransactionById(TX_ID, STAFF_ID, "ROLE_ADMIN"));
        }
    }

    // ── getTransactionsByBooking ─────────────────────────────────────────────

    @Nested
    class GetTransactionsByBooking {

        @Test
        void css_callsPolicy() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking(GARAGE_ID)));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID))
                    .thenReturn(new StaffProfile());
            when(transactionRepository.findByBookingIdOrderByCreatedAtDesc(BOOKING_ID)).thenReturn(java.util.List.of());

            assertDoesNotThrow(() -> paymentService.getTransactionsByBooking(BOOKING_ID, STAFF_ID, "ROLE_STAFF"));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
        }

        @Test
        void vcs_throwsForbidden() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking(GARAGE_ID)));
            doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"))
                    .when(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> paymentService.getTransactionsByBooking(BOOKING_ID, STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void admin_callsPolicy() {
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking(GARAGE_ID)));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID))
                    .thenReturn(null);
            when(transactionRepository.findByBookingIdOrderByCreatedAtDesc(BOOKING_ID)).thenReturn(java.util.List.of());

            assertDoesNotThrow(() -> paymentService.getTransactionsByBooking(BOOKING_ID, STAFF_ID, "ROLE_ADMIN"));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID);
        }
    }

    // ── cancelTransaction ────────────────────────────────────────────────────

    @Nested
    class CancelTransaction {

        @Test
        void css_callsPolicy() throws Exception {
            PaymentTransaction tx = pendingTx(BOOKING_ID);
            when(transactionRepository.findById(TX_ID)).thenReturn(Optional.of(tx));
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking(GARAGE_ID)));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID))
                    .thenReturn(new StaffProfile());
            when(payOS.cancelPaymentLink(anyLong(), anyString())).thenReturn(null);
            when(transactionRepository.save(any())).thenReturn(tx);

            assertDoesNotThrow(() -> paymentService.cancelTransaction(TX_ID, STAFF_ID, "ROLE_STAFF"));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
        }

        @Test
        void vcs_throwsForbidden() {
            when(transactionRepository.findById(TX_ID)).thenReturn(Optional.of(pendingTx(BOOKING_ID)));
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking(GARAGE_ID)));
            doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"))
                    .when(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> paymentService.cancelTransaction(TX_ID, STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void admin_allowed() throws Exception {
            PaymentTransaction tx = pendingTx(BOOKING_ID);
            when(transactionRepository.findById(TX_ID)).thenReturn(Optional.of(tx));
            when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking(GARAGE_ID)));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID))
                    .thenReturn(null);
            when(payOS.cancelPaymentLink(anyLong(), anyString())).thenReturn(null);
            when(transactionRepository.save(any())).thenReturn(tx);

            assertDoesNotThrow(() -> paymentService.cancelTransaction(TX_ID, STAFF_ID, "ROLE_ADMIN"));
        }
    }
}
