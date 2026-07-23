package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CreatePayOSPaymentRequest;
import com.autowashpro.dto.request.MarkBookingPaidRequest;
import com.autowashpro.dto.response.CreatePayOSPaymentResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.PaymentTransaction;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.repository.BookingAddOnServicePackageRepository;
import com.autowashpro.repository.BookingAssignedStaffRepository;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.BookingServiceStepRepository;
import com.autowashpro.repository.CustomerLoyaltyRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.LoyaltyTierRuleRepository;
import com.autowashpro.repository.PaymentTransactionRepository;
import com.autowashpro.repository.PointTransactionRepository;
import com.autowashpro.repository.PromotionRepository;
import com.autowashpro.repository.PromotionUsageRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.ServicePackageStepRepository;
import com.autowashpro.repository.StaffProfileRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.repository.VehicleInspectionRepository;
import com.autowashpro.repository.VehicleRepository;
import com.autowashpro.repository.WashBayRepository;
import com.autowashpro.service.AuditLogService;
import com.autowashpro.service.BookingReviewService;
import com.autowashpro.service.BookingService;
import com.autowashpro.service.EmailService;
import com.autowashpro.service.LoyaltyPointExpiryService;
import com.autowashpro.service.LoyaltyService;
import com.autowashpro.service.NotificationService;
import com.autowashpro.service.PromotionService;
import com.autowashpro.service.WashHistoryService;
import com.autowashpro.service.support.StaffOperationAccessPolicy;
import com.autowashpro.support.TestFixtures;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import vn.payos.PayOS;
import vn.payos.type.Webhook;
import vn.payos.type.WebhookData;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for the DEPOSIT + FINAL payment flow in PaymentServiceImpl and BookingServiceImpl.
 * Covers createPayOSPayment validation, webhook side effects, and cash mark-paid logic.
 */
class PaymentFinalFlowTest {

    // ==========================================================================
    // Group A: PaymentServiceImpl.createPayOSPayment — validation (tests 1–8)
    // ==========================================================================
    @Nested
    @ExtendWith(MockitoExtension.class)
    @MockitoSettings(strictness = Strictness.LENIENT)
    class CreatePayOSPaymentTests {

        @Mock private PayOS payOS;
        @Spy  private ObjectMapper objectMapper = new ObjectMapper();
        @Mock private RestTemplate restTemplate;
        @Mock private PlatformTransactionManager transactionManager;
        @Mock private BookingRepository bookingRepository;
        @Mock private PaymentTransactionRepository transactionRepository;
        @Mock private LoyaltyService loyaltyService;
        @Mock private WashHistoryService washHistoryService;
        @Mock private NotificationService notificationService;
        @Mock private AuditLogService auditLogService;
        @Mock private BookingReviewService bookingReviewService;
        @Mock private EmailService emailService;
        @Mock private PromotionRepository promotionRepository;
        @Mock private PromotionUsageRepository promotionUsageRepository;
        @Mock private BookingService bookingService;
        @Mock private com.autowashpro.service.support.StaffOperationAccessPolicy staffOperationAccessPolicy;

        @InjectMocks private PaymentServiceImpl paymentService;

        @BeforeEach
        void setUp() {
            // Set @Value fields that would normally be injected by Spring context
            ReflectionTestUtils.setField(paymentService, "checksumKey", "test-checksum-key");
            ReflectionTestUtils.setField(paymentService, "returnUrl", "https://example.com/return");
            ReflectionTestUtils.setField(paymentService, "cancelUrl", "https://example.com/cancel");
            ReflectionTestUtils.setField(paymentService, "clientId", "test-client-id");
            ReflectionTestUtils.setField(paymentService, "apiKey", "test-api-key");
            ReflectionTestUtils.setField(paymentService, "payosApiUrl", "https://api-merchant.payos.vn/v2/payment-requests");

            lenient().when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> {
                        PaymentTransaction tx = inv.getArgument(0);
                        if (tx.getId() == null) tx.setId(99L);
                        return tx;
                    });
            lenient().when(bookingRepository.save(any(Booking.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            lenient().when(transactionRepository.findByBookingIdAndPurposeOrderByCreatedAtDesc(anyLong(), anyString()))
                    .thenReturn(List.of());
        }

        /** Test 1: DEPOSIT purpose on PENDING_DEPOSIT booking succeeds and uses depositAmount. */
        @Test
        void test1_createDeposit_on_pendingDepositBooking_succeeds() {
            Booking booking = pendingDepositBooking(120_000);
            when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenReturn(payosApiResponse());

            CreatePayOSPaymentRequest req = depositRequest(booking.getId());
            CreatePayOSPaymentResponse response = paymentService.createPayOSPaymentForStaff(req, 1L, "ROLE_ADMIN");

            assertNotNull(response);
            assertNotNull(response.getCheckoutUrl());
            // Verify the saved transaction has DEPOSIT purpose and the deposit amount
            ArgumentCaptor<PaymentTransaction> txCaptor = ArgumentCaptor.forClass(PaymentTransaction.class);
            verify(transactionRepository).save(txCaptor.capture());
            PaymentTransaction saved = txCaptor.getValue();
            assertEquals("DEPOSIT", saved.getPurpose());
            assertEquals(0, booking.getDepositAmount().compareTo(saved.getAmount()));
        }

        /** Test 2: DEPOSIT purpose on CONFIRMED booking (wrong status) → 400. */
        @Test
        void test2_createDeposit_on_confirmedBooking_throws400() {
            Booking booking = confirmedBooking();
            when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> paymentService.createPayOSPaymentForStaff(depositRequest(booking.getId()), 1L, "ROLE_ADMIN"));

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        }

        /** Test 3: DEPOSIT purpose when depositStatus is already PAID → 400. */
        @Test
        void test3_createDeposit_whenDepositAlreadyPaid_throws400() {
            Booking booking = pendingDepositBooking(120_000);
            booking.setDepositStatus("PAID");
            when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> paymentService.createPayOSPaymentForStaff(depositRequest(booking.getId()), 1L, "ROLE_ADMIN"));

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        }

        /** Test 4: DEPOSIT purpose when depositAmount is null → 400. */
        @Test
        void test4_createDeposit_withNullDepositAmount_throws400() {
            Booking booking = pendingDepositBooking(120_000);
            booking.setDepositAmount(null);
            when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> paymentService.createPayOSPaymentForStaff(depositRequest(booking.getId()), 1L, "ROLE_ADMIN"));

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        }

        /** Test 5: FINAL purpose on COMPLETED booking with partial deposit paid → uses remaining amount. */
        @Test
        void createDeposit_afterPaymentDeadline_throws409WithoutCreatingTransaction() {
            Booking booking = pendingDepositBooking(120_000);
            booking.setPaymentExpiredAt(LocalDateTime.now().minusSeconds(1));
            when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> paymentService.createPayOSPaymentForStaff(
                            depositRequest(booking.getId()), 1L, "ROLE_ADMIN"));

            assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
            verify(restTemplate, never()).postForEntity(anyString(), any(), eq(Map.class));
            verify(transactionRepository, never()).save(any(PaymentTransaction.class));
        }

        @Test
        void test5_createFinal_on_completedBooking_usesRemainingAmount() {
            // finalPrice=120000, depositAmount=36000 (PAID) → remaining=84000
            Booking booking = completedBookingWithDepositPaid(120_000, 36_000);
            when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenReturn(payosApiResponse());

            CreatePayOSPaymentRequest req = finalRequest(booking.getId());
            paymentService.createPayOSPaymentForStaff(req, 1L, "ROLE_ADMIN");

            ArgumentCaptor<PaymentTransaction> txCaptor = ArgumentCaptor.forClass(PaymentTransaction.class);
            verify(transactionRepository).save(txCaptor.capture());
            PaymentTransaction saved = txCaptor.getValue();
            assertEquals("FINAL", saved.getPurpose());
            // remaining = 120000 - 36000 = 84000
            assertEquals(0, new BigDecimal("84000.00").compareTo(saved.getAmount()),
                    "FINAL transaction amount must be the remaining balance (finalPrice - depositAmount)");
        }

        /** Test 6: FINAL purpose on non-COMPLETED booking (e.g. CONFIRMED) → 400. */
        @Test
        void test6_createFinal_on_confirmedBooking_throws400() {
            Booking booking = confirmedBooking();
            when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> paymentService.createPayOSPaymentForStaff(finalRequest(booking.getId()), 1L, "ROLE_ADMIN"));

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        }

        /** Test 7: FINAL purpose when paymentStatus is already PAID → 400. */
        @Test
        void test7_createFinal_whenAlreadyFullyPaid_throws400() {
            Booking booking = completedBookingWithDepositPaid(120_000, 36_000);
            booking.setPaymentStatus("PAID");
            when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> paymentService.createPayOSPaymentForStaff(finalRequest(booking.getId()), 1L, "ROLE_ADMIN"));

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        }

        /** Test 8: Invalid purpose string → 400. */
        @Test
        void test8_createPayOS_withInvalidPurpose_throws400() {
            Booking booking = pendingDepositBooking(120_000);
            when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

            CreatePayOSPaymentRequest req = new CreatePayOSPaymentRequest();
            req.setBookingId(booking.getId());
            req.setPurpose("INVALID");

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> paymentService.createPayOSPaymentForStaff(req, 1L, "ROLE_ADMIN"));

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        }

        // ── helpers ──────────────────────────────────────────────────────────

        private Booking pendingDepositBooking(long finalPriceVnd) {
            User customer = TestFixtures.customer();
            Vehicle vehicle = TestFixtures.car(customer);
            ServicePackage pkg = TestFixtures.carWashPackage();
            Booking b = TestFixtures.confirmedBooking(customer, vehicle, TestFixtures.garage(), pkg);
            b.setId(10L);
            b.setStatus("PENDING_DEPOSIT");
            b.setPaymentStatus("UNPAID");
            b.setFinalPrice(BigDecimal.valueOf(finalPriceVnd));
            b.setDepositAmount(BigDecimal.valueOf(finalPriceVnd).multiply(new BigDecimal("0.30")));
            b.setDepositStatus("UNPAID");
            return b;
        }

        private Booking confirmedBooking() {
            User customer = TestFixtures.customer();
            Vehicle vehicle = TestFixtures.car(customer);
            ServicePackage pkg = TestFixtures.carWashPackage();
            Booking b = TestFixtures.confirmedBooking(customer, vehicle, TestFixtures.garage(), pkg);
            b.setId(11L);
            b.setStatus("CONFIRMED");
            b.setPaymentStatus("UNPAID");
            return b;
        }

        private Booking completedBookingWithDepositPaid(long finalPriceVnd, long depositVnd) {
            User customer = TestFixtures.customer();
            Vehicle vehicle = TestFixtures.car(customer);
            ServicePackage pkg = TestFixtures.carWashPackage();
            Booking b = TestFixtures.confirmedBooking(customer, vehicle, TestFixtures.garage(), pkg);
            b.setId(12L);
            b.setStatus("COMPLETED");
            b.setPaymentStatus("UNPAID");
            b.setFinalPrice(BigDecimal.valueOf(finalPriceVnd));
            b.setDepositAmount(BigDecimal.valueOf(depositVnd));
            b.setDepositStatus("PAID");
            b.setDepositPaidAt(LocalDateTime.now().minusHours(1));
            return b;
        }

        private CreatePayOSPaymentRequest depositRequest(Long bookingId) {
            CreatePayOSPaymentRequest req = new CreatePayOSPaymentRequest();
            req.setBookingId(bookingId);
            req.setPurpose("DEPOSIT");
            return req;
        }

        private CreatePayOSPaymentRequest finalRequest(Long bookingId) {
            CreatePayOSPaymentRequest req = new CreatePayOSPaymentRequest();
            req.setBookingId(bookingId);
            req.setPurpose("FINAL");
            return req;
        }

        @SuppressWarnings({"rawtypes", "unchecked"})
        private ResponseEntity<Map> payosApiResponse() {
            Map<String, Object> responseData = new HashMap<>();
            responseData.put("checkoutUrl", "https://pay.payos.vn/web/test123");
            responseData.put("qrCode", "qr-data-test");
            Map<String, Object> body = new HashMap<>();
            body.put("data", responseData);
            return new ResponseEntity<>(body, HttpStatus.OK);
        }
    }

    // ==========================================================================
    // Group B: Deposit webhook side effects (tests 9–10)
    // ==========================================================================
    @Nested
    @ExtendWith(MockitoExtension.class)
    @MockitoSettings(strictness = Strictness.LENIENT)
    class DepositWebhookSideEffectsTests {

        @Mock private PayOS payOS;
        @Spy  private ObjectMapper objectMapper = new ObjectMapper();
        @Mock private RestTemplate restTemplate;
        @Mock private PlatformTransactionManager transactionManager;
        @Mock private BookingRepository bookingRepository;
        @Mock private PaymentTransactionRepository transactionRepository;
        @Mock private LoyaltyService loyaltyService;
        @Mock private WashHistoryService washHistoryService;
        @Mock private NotificationService notificationService;
        @Mock private AuditLogService auditLogService;
        @Mock private BookingReviewService bookingReviewService;
        @Mock private EmailService emailService;
        @Mock private PromotionRepository promotionRepository;
        @Mock private PromotionUsageRepository promotionUsageRepository;
        @Mock private BookingService bookingService;

        @InjectMocks private PaymentServiceImpl paymentService;

        @BeforeEach
        void setUp() {
            lenient().when(transactionManager.getTransaction(any(TransactionDefinition.class)))
                    .thenReturn(new SimpleTransactionStatus());
            lenient().when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            lenient().when(bookingRepository.save(any(Booking.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
        }

        /**
         * Test 9: After a successful DEPOSIT webhook, bookingService.reserveCareStaffIfNeeded
         * must be called with the booking ID.
         */
        @Test
        void test9_depositWebhook_success_callsReserveCareStaff() throws Exception {
            Booking booking = pendingDepositBooking();
            PaymentTransaction tx = depositTransaction(booking);

            when(payOS.verifyPaymentWebhookData(any(Webhook.class)))
                    .thenReturn(webhookData(tx.getOrderCode(), "00"));
            when(transactionRepository.findByOrderCode(tx.getOrderCode()))
                    .thenReturn(Optional.of(tx));
            when(bookingRepository.findById(booking.getId()))
                    .thenReturn(Optional.of(booking));

            paymentService.handlePayOSWebhook(webhookPayload(tx.getOrderCode(), "00"));

            verify(bookingService).reserveCareStaffIfNeeded(booking.getId());
        }

        /**
         * Test 10: A failed DEPOSIT webhook (non-"00" code) must set depositStatus=CANCELED
         * on the booking (only for DEPOSIT transactions).
         */
        @Test
        void test10_depositWebhook_failure_setsDepositCanceled() throws Exception {
            Booking booking = pendingDepositBooking();
            PaymentTransaction tx = depositTransaction(booking);

            when(payOS.verifyPaymentWebhookData(any(Webhook.class)))
                    .thenReturn(webhookData(tx.getOrderCode(), "01"));
            when(transactionRepository.findByOrderCode(tx.getOrderCode()))
                    .thenReturn(Optional.of(tx));
            when(bookingRepository.findById(booking.getId()))
                    .thenReturn(Optional.of(booking));

            paymentService.handlePayOSWebhook(webhookPayload(tx.getOrderCode(), "01"));

            ArgumentCaptor<Booking> bookingCaptor = ArgumentCaptor.forClass(Booking.class);
            verify(bookingRepository).save(bookingCaptor.capture());
            assertEquals("CANCELED", bookingCaptor.getValue().getDepositStatus());
        }

        // ── helpers ──────────────────────────────────────────────────────────

        private Booking pendingDepositBooking() {
            User customer = TestFixtures.customer();
            Vehicle vehicle = TestFixtures.car(customer);
            ServicePackage pkg = TestFixtures.carWashPackage();
            Booking b = TestFixtures.confirmedBooking(customer, vehicle, TestFixtures.garage(), pkg);
            b.setId(20L);
            b.setStatus("PENDING_DEPOSIT");
            b.setPaymentStatus("UNPAID");
            b.setDepositAmount(new BigDecimal("36000.00"));
            b.setDepositStatus("UNPAID");
            return b;
        }

        private PaymentTransaction depositTransaction(Booking booking) {
            PaymentTransaction tx = new PaymentTransaction();
            tx.setId(50L);
            tx.setBookingId(booking.getId());
            tx.setPaymentMethod("PAYOS");
            tx.setPurpose("DEPOSIT");
            tx.setAmount(booking.getDepositAmount());
            tx.setStatus("PENDING");
            tx.setOrderCode(111222333L);
            return tx;
        }

        private WebhookData webhookData(Long orderCode, String code) {
            return WebhookData.builder()
                    .orderCode(orderCode).amount(36000).description("DH#20")
                    .accountNumber("123456789").reference("FT123456")
                    .transactionDateTime("2026-07-10 10:00:00").currency("VND")
                    .paymentLinkId("link-abc").code(code).desc("Webhook")
                    .counterAccountBankId("970436").counterAccountBankName("Vietcombank")
                    .counterAccountName("Nguyen Van A").counterAccountNumber("987654321")
                    .virtualAccountName("AutoWashPro").virtualAccountNumber("111222333")
                    .build();
        }

        private Map<String, Object> webhookPayload(Long orderCode, String code) {
            Map<String, Object> data = new HashMap<>();
            data.put("orderCode", orderCode); data.put("amount", 36000);
            data.put("description", "DH#20"); data.put("accountNumber", "123456789");
            data.put("reference", "FT123456"); data.put("transactionDateTime", "2026-07-10 10:00:00");
            data.put("currency", "VND"); data.put("paymentLinkId", "link-abc");
            data.put("code", code); data.put("desc", "Webhook");
            data.put("counterAccountBankId", "970436"); data.put("counterAccountBankName", "Vietcombank");
            data.put("counterAccountName", "Nguyen Van A"); data.put("counterAccountNumber", "987654321");
            data.put("virtualAccountName", "AutoWashPro"); data.put("virtualAccountNumber", "111222333");
            Map<String, Object> payload = new HashMap<>();
            payload.put("code", code); payload.put("desc", "Webhook");
            payload.put("success", "00".equals(code)); payload.put("signature", "sig");
            payload.put("data", data);
            return payload;
        }
    }

    // ==========================================================================
    // Group C: Final webhook behavior (tests 11–14)
    // ==========================================================================
    @Nested
    @ExtendWith(MockitoExtension.class)
    @MockitoSettings(strictness = Strictness.LENIENT)
    class FinalWebhookBehaviorTests {

        @Mock private PayOS payOS;
        @Spy  private ObjectMapper objectMapper = new ObjectMapper();
        @Mock private RestTemplate restTemplate;
        @Mock private PlatformTransactionManager transactionManager;
        @Mock private BookingRepository bookingRepository;
        @Mock private PaymentTransactionRepository transactionRepository;
        @Mock private LoyaltyService loyaltyService;
        @Mock private WashHistoryService washHistoryService;
        @Mock private NotificationService notificationService;
        @Mock private AuditLogService auditLogService;
        @Mock private BookingReviewService bookingReviewService;
        @Mock private EmailService emailService;
        @Mock private PromotionRepository promotionRepository;
        @Mock private PromotionUsageRepository promotionUsageRepository;
        @Mock private BookingService bookingService;

        @InjectMocks private PaymentServiceImpl paymentService;

        @BeforeEach
        void setUp() {
            lenient().when(transactionManager.getTransaction(any(TransactionDefinition.class)))
                    .thenReturn(new SimpleTransactionStatus());
            lenient().when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            lenient().when(bookingRepository.save(any(Booking.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            lenient().when(promotionUsageRepository.existsByBookingId(anyLong())).thenReturn(false);
        }

        /**
         * Test 11: A successful FINAL webhook must NOT set depositStatus=PAID.
         * Deposit fields belong exclusively to the DEPOSIT payment path.
         */
        @Test
        void test11_finalWebhook_doesNotSetDepositStatusPaid() throws Exception {
            Booking booking = completedBookingWithDepositPaid();
            PaymentTransaction tx = finalTransaction(booking);

            setupWebhookMocks(booking, tx, "00");
            paymentService.handlePayOSWebhook(webhookPayload(tx.getOrderCode(), "00"));

            ArgumentCaptor<Booking> captor = ArgumentCaptor.forClass(Booking.class);
            verify(bookingRepository).save(captor.capture());
            // depositStatus was "PAID" before the webhook — it must still be "PAID" (unchanged).
            // It must NEVER be re-set by the FINAL webhook.
            assertEquals("PAID", captor.getValue().getDepositStatus(),
                    "FINAL webhook must not overwrite depositStatus — it must keep its pre-webhook value");
        }

        /**
         * Test 12: A successful FINAL webhook must NOT change booking.status.
         * The booking should remain COMPLETED (not regress to CONFIRMED).
         */
        @Test
        void test12_finalWebhook_doesNotChangeBookingStatus() throws Exception {
            Booking booking = completedBookingWithDepositPaid();
            PaymentTransaction tx = finalTransaction(booking);

            setupWebhookMocks(booking, tx, "00");
            paymentService.handlePayOSWebhook(webhookPayload(tx.getOrderCode(), "00"));

            ArgumentCaptor<Booking> captor = ArgumentCaptor.forClass(Booking.class);
            verify(bookingRepository).save(captor.capture());
            assertEquals("COMPLETED", captor.getValue().getStatus(),
                    "FINAL webhook must keep booking.status=COMPLETED, not regress to CONFIRMED");
        }

        /**
         * Test 13: A successful FINAL webhook must set paymentStatus=PAID and paidAt.
         */
        @Test
        void test13_finalWebhook_setsPaymentStatusPaidAndPaidAt() throws Exception {
            Booking booking = completedBookingWithDepositPaid();
            PaymentTransaction tx = finalTransaction(booking);

            setupWebhookMocks(booking, tx, "00");
            paymentService.handlePayOSWebhook(webhookPayload(tx.getOrderCode(), "00"));

            ArgumentCaptor<Booking> captor = ArgumentCaptor.forClass(Booking.class);
            verify(bookingRepository).save(captor.capture());
            Booking saved = captor.getValue();
            assertEquals("PAID", saved.getPaymentStatus(),
                    "FINAL webhook must set paymentStatus=PAID");
            assertNotNull(saved.getPaidAt(),
                    "FINAL webhook must set paidAt");
        }

        /**
         * Test 14: A successful FINAL webhook must NOT overwrite depositPaidAt or
         * depositTransactionId — those fields were set by the earlier DEPOSIT webhook.
         */
        @Test
        void test14_finalWebhook_doesNotOverwriteDepositFields() throws Exception {
            Booking booking = completedBookingWithDepositPaid();
            LocalDateTime originalDepositPaidAt = booking.getDepositPaidAt();
            Long originalDepositTransactionId = booking.getDepositTransactionId();

            PaymentTransaction tx = finalTransaction(booking);

            setupWebhookMocks(booking, tx, "00");
            paymentService.handlePayOSWebhook(webhookPayload(tx.getOrderCode(), "00"));

            ArgumentCaptor<Booking> captor = ArgumentCaptor.forClass(Booking.class);
            verify(bookingRepository).save(captor.capture());
            Booking saved = captor.getValue();

            assertEquals(originalDepositPaidAt, saved.getDepositPaidAt(),
                    "FINAL webhook must not change depositPaidAt");
            assertEquals(originalDepositTransactionId, saved.getDepositTransactionId(),
                    "FINAL webhook must not change depositTransactionId");
        }

        // ── helpers ──────────────────────────────────────────────────────────

        private Booking completedBookingWithDepositPaid() {
            User customer = TestFixtures.customer();
            Vehicle vehicle = TestFixtures.car(customer);
            ServicePackage pkg = TestFixtures.carWashPackage();
            Booking b = TestFixtures.confirmedBooking(customer, vehicle, TestFixtures.garage(), pkg);
            b.setId(30L);
            b.setStatus("COMPLETED");
            b.setPaymentStatus("UNPAID");
            b.setFinalPrice(new BigDecimal("120000.00"));
            b.setDepositAmount(new BigDecimal("36000.00"));
            b.setDepositStatus("PAID");
            b.setDepositPaidAt(LocalDateTime.of(2026, 7, 10, 9, 0));
            b.setDepositTransactionId(50L); // ID of the earlier DEPOSIT transaction
            return b;
        }

        private PaymentTransaction finalTransaction(Booking booking) {
            PaymentTransaction tx = new PaymentTransaction();
            tx.setId(60L);
            tx.setBookingId(booking.getId());
            tx.setPaymentMethod("PAYOS");
            tx.setPurpose("FINAL");
            tx.setAmount(new BigDecimal("84000.00"));
            tx.setStatus("PENDING");
            tx.setOrderCode(444555666L);
            return tx;
        }

        private void setupWebhookMocks(Booking booking, PaymentTransaction tx, String code) throws Exception {
            when(payOS.verifyPaymentWebhookData(any(Webhook.class)))
                    .thenReturn(webhookData(tx.getOrderCode(), code));
            when(transactionRepository.findByOrderCode(tx.getOrderCode()))
                    .thenReturn(Optional.of(tx));
            when(bookingRepository.findById(booking.getId()))
                    .thenReturn(Optional.of(booking));
        }

        private WebhookData webhookData(Long orderCode, String code) {
            return WebhookData.builder()
                    .orderCode(orderCode).amount(84000).description("DH#30")
                    .accountNumber("123456789").reference("FT789012")
                    .transactionDateTime("2026-07-10 14:00:00").currency("VND")
                    .paymentLinkId("link-xyz").code(code).desc("Webhook")
                    .counterAccountBankId("970436").counterAccountBankName("Vietcombank")
                    .counterAccountName("Nguyen Van A").counterAccountNumber("987654321")
                    .virtualAccountName("AutoWashPro").virtualAccountNumber("111222333")
                    .build();
        }

        private Map<String, Object> webhookPayload(Long orderCode, String code) {
            Map<String, Object> data = new HashMap<>();
            data.put("orderCode", orderCode); data.put("amount", 84000);
            data.put("description", "DH#30"); data.put("accountNumber", "123456789");
            data.put("reference", "FT789012"); data.put("transactionDateTime", "2026-07-10 14:00:00");
            data.put("currency", "VND"); data.put("paymentLinkId", "link-xyz");
            data.put("code", code); data.put("desc", "Webhook");
            data.put("counterAccountBankId", "970436"); data.put("counterAccountBankName", "Vietcombank");
            data.put("counterAccountName", "Nguyen Van A"); data.put("counterAccountNumber", "987654321");
            data.put("virtualAccountName", "AutoWashPro"); data.put("virtualAccountNumber", "111222333");
            Map<String, Object> payload = new HashMap<>();
            payload.put("code", code); payload.put("desc", "Webhook");
            payload.put("success", "00".equals(code)); payload.put("signature", "sig");
            payload.put("data", data);
            return payload;
        }
    }

    // ==========================================================================
    // Group E: Strict webhook purpose validation (tests 18–19) — FIX 5
    // ==========================================================================
    @Nested
    @ExtendWith(MockitoExtension.class)
    @MockitoSettings(strictness = Strictness.LENIENT)
    class WebhookPurposeValidationTests {

        @Mock private PayOS payOS;
        @Spy  private ObjectMapper objectMapper = new ObjectMapper();
        @Mock private RestTemplate restTemplate;
        @Mock private PlatformTransactionManager transactionManager;
        @Mock private BookingRepository bookingRepository;
        @Mock private PaymentTransactionRepository transactionRepository;
        @Mock private LoyaltyService loyaltyService;
        @Mock private WashHistoryService washHistoryService;
        @Mock private NotificationService notificationService;
        @Mock private AuditLogService auditLogService;
        @Mock private BookingReviewService bookingReviewService;
        @Mock private EmailService emailService;
        @Mock private PromotionRepository promotionRepository;
        @Mock private PromotionUsageRepository promotionUsageRepository;
        @Mock private BookingService bookingService;

        @InjectMocks private PaymentServiceImpl paymentService;

        @BeforeEach
        void setUp() {
            lenient().when(transactionManager.getTransaction(any(TransactionDefinition.class)))
                    .thenReturn(new SimpleTransactionStatus());
            lenient().when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            lenient().when(bookingRepository.save(any(Booking.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            lenient().when(promotionUsageRepository.existsByBookingId(anyLong())).thenReturn(false);
        }

        /**
         * Test 18: A webhook with purpose=null (or any non-DEPOSIT/non-FINAL value) on a
         * successful payment (code="00") must be rejected early.
         * The booking's paymentStatus must NOT be updated to PAID.
         */
        @Test
        void test18_webhook_nullPurpose_isRejectedAndBookingNotMarkedPaid() throws Exception {
            Booking booking = completedBookingUnpaid();
            PaymentTransaction tx = transactionWithPurpose(booking, null); // null purpose

            when(payOS.verifyPaymentWebhookData(any(Webhook.class)))
                    .thenReturn(webhookData(tx.getOrderCode(), "00"));
            when(transactionRepository.findByOrderCode(tx.getOrderCode()))
                    .thenReturn(Optional.of(tx));
            // bookingRepository.findById should NOT be called if we return early
            lenient().when(bookingRepository.findById(booking.getId()))
                    .thenReturn(Optional.of(booking));

            paymentService.handlePayOSWebhook(webhookPayload(tx.getOrderCode(), "00"));

            // The transaction must NOT be saved with PENDING→PAID because we returned early.
            // bookingRepository.save must also not be called.
            org.mockito.Mockito.verify(bookingRepository, org.mockito.Mockito.never()).save(any(Booking.class));
        }

        /**
         * Test 18b: Same as 18 but with purpose="OTHER" (unknown string instead of null).
         */
        @Test
        void test18b_webhook_unknownStringPurpose_isRejected() throws Exception {
            Booking booking = completedBookingUnpaid();
            PaymentTransaction tx = transactionWithPurpose(booking, "OTHER"); // unknown purpose

            when(payOS.verifyPaymentWebhookData(any(Webhook.class)))
                    .thenReturn(webhookData(tx.getOrderCode(), "00"));
            when(transactionRepository.findByOrderCode(tx.getOrderCode()))
                    .thenReturn(Optional.of(tx));
            lenient().when(bookingRepository.findById(booking.getId()))
                    .thenReturn(Optional.of(booking));

            paymentService.handlePayOSWebhook(webhookPayload(tx.getOrderCode(), "00"));

            org.mockito.Mockito.verify(bookingRepository, org.mockito.Mockito.never()).save(any(Booking.class));
        }

        /**
         * Test 19: A CANCELLED webhook (code != "00") for a FINAL-purpose transaction
         * must NOT modify depositStatus on the booking.
         * Deposit fields are exclusively managed by the DEPOSIT payment path.
         */
        @Test
        void test19_cancelledFinalWebhook_doesNotTouchDepositStatus() throws Exception {
            Booking booking = completedBookingWithDepositPaid();
            final String originalDepositStatus = booking.getDepositStatus();

            PaymentTransaction tx = new PaymentTransaction();
            tx.setId(70L);
            tx.setBookingId(booking.getId());
            tx.setPaymentMethod("PAYOS");
            tx.setPurpose("FINAL"); // FINAL purpose, not DEPOSIT
            tx.setAmount(new BigDecimal("84000.00"));
            tx.setStatus("PENDING");
            tx.setOrderCode(777888999L);

            when(payOS.verifyPaymentWebhookData(any(Webhook.class)))
                    .thenReturn(webhookData(tx.getOrderCode(), "01"));
            when(transactionRepository.findByOrderCode(tx.getOrderCode()))
                    .thenReturn(Optional.of(tx));
            lenient().when(bookingRepository.findById(booking.getId()))
                    .thenReturn(Optional.of(booking));

            paymentService.handlePayOSWebhook(webhookPayload(tx.getOrderCode(), "01"));

            // bookingRepository.save must NOT be called for a cancelled FINAL transaction
            // (only DEPOSIT cancellations touch the booking's depositStatus).
            org.mockito.Mockito.verify(bookingRepository, org.mockito.Mockito.never()).save(any(Booking.class));
            // The booking's depositStatus must remain unchanged.
            assertEquals(originalDepositStatus, booking.getDepositStatus(),
                    "Cancelled FINAL webhook must not alter depositStatus");
        }

        // NOTE — Test 20 (staffBookingList_depositPaidTx_doesNotShowBookingAsPaid) covers
        // frontend-only logic in StaffBookingListPage.jsx (enrichBookingsWithPayment).
        // This is verified as a manual test: create a booking with only a DEPOSIT PAID
        // transaction, confirm the card's PaymentBadge shows "Unpaid" (not "Paid").

        // ── helpers ──────────────────────────────────────────────────────────

        private Booking completedBookingUnpaid() {
            User customer = TestFixtures.customer();
            Vehicle vehicle = TestFixtures.car(customer);
            ServicePackage pkg = TestFixtures.carWashPackage();
            Booking b = TestFixtures.confirmedBooking(customer, vehicle, TestFixtures.garage(), pkg);
            b.setId(50L);
            b.setStatus("COMPLETED");
            b.setPaymentStatus("UNPAID");
            b.setFinalPrice(new BigDecimal("120000.00"));
            b.setDepositAmount(new BigDecimal("36000.00"));
            b.setDepositStatus("PAID");
            b.setDepositPaidAt(LocalDateTime.of(2026, 7, 10, 9, 0));
            b.setDepositTransactionId(55L);
            return b;
        }

        private Booking completedBookingWithDepositPaid() {
            return completedBookingUnpaid(); // same fixture
        }

        private PaymentTransaction transactionWithPurpose(Booking booking, String purpose) {
            PaymentTransaction tx = new PaymentTransaction();
            tx.setId(65L);
            tx.setBookingId(booking.getId());
            tx.setPaymentMethod("PAYOS");
            tx.setPurpose(purpose);
            tx.setAmount(new BigDecimal("84000.00"));
            tx.setStatus("PENDING");
            tx.setOrderCode(666777888L);
            return tx;
        }

        private WebhookData webhookData(Long orderCode, String code) {
            return WebhookData.builder()
                    .orderCode(orderCode).amount(84000).description("DH#50")
                    .accountNumber("123456789").reference("FT999")
                    .transactionDateTime("2026-07-10 15:00:00").currency("VND")
                    .paymentLinkId("link-test").code(code).desc("Webhook")
                    .counterAccountBankId("970436").counterAccountBankName("Vietcombank")
                    .counterAccountName("Nguyen Van A").counterAccountNumber("987654321")
                    .virtualAccountName("AutoWashPro").virtualAccountNumber("111222333")
                    .build();
        }

        private Map<String, Object> webhookPayload(Long orderCode, String code) {
            Map<String, Object> data = new HashMap<>();
            data.put("orderCode", orderCode); data.put("amount", 84000);
            data.put("description", "DH#50"); data.put("accountNumber", "123456789");
            data.put("reference", "FT999"); data.put("transactionDateTime", "2026-07-10 15:00:00");
            data.put("currency", "VND"); data.put("paymentLinkId", "link-test");
            data.put("code", code); data.put("desc", "Webhook");
            data.put("counterAccountBankId", "970436"); data.put("counterAccountBankName", "Vietcombank");
            data.put("counterAccountName", "Nguyen Van A"); data.put("counterAccountNumber", "987654321");
            data.put("virtualAccountName", "AutoWashPro"); data.put("virtualAccountNumber", "111222333");
            Map<String, Object> payload = new HashMap<>();
            payload.put("code", code); payload.put("desc", "Webhook");
            payload.put("success", "00".equals(code)); payload.put("signature", "sig");
            payload.put("data", data);
            return payload;
        }
    }

    // ==========================================================================
    // Group D: BookingServiceImpl.markBookingPaid — cash payment (tests 15–17)
    // ==========================================================================
    @Nested
    @ExtendWith(MockitoExtension.class)
    @MockitoSettings(strictness = Strictness.LENIENT)
    class CashMarkPaidTests {

        @Mock private GarageRepository garageRepository;
        @Mock private ServicePackageRepository servicePackageRepository;
        @Mock private WashBayRepository washBayRepository;
        @Mock private BookingRepository bookingRepository;
        @Mock private PaymentTransactionRepository paymentTransactionRepository;
        @Mock private VehicleRepository vehicleRepository;
        @Mock private CustomerLoyaltyRepository customerLoyaltyRepository;
        @Mock private LoyaltyTierRuleRepository loyaltyTierRuleRepository;
        @Mock private PromotionRepository promotionRepository;
        @Mock private PromotionUsageRepository promotionUsageRepository;
        @Mock private BookingAssignedStaffRepository bookingAssignedStaffRepository;
        @Mock private StaffProfileRepository staffProfileRepository;
        @Mock private UserRepository userRepository;
        @Mock private BookingServiceStepRepository bookingServiceStepRepository;
        @Mock private ServicePackageStepRepository servicePackageStepRepository;
        @Mock private VehicleInspectionRepository vehicleInspectionRepository;
        @Mock private ComboStepResolver comboStepResolver;
        @Mock private BookingAddOnServicePackageRepository bookingAddOnServicePackageRepository;
        @Mock private PointTransactionRepository pointTransactionRepository;
        @Mock private LoyaltyService loyaltyService;
        @Mock private LoyaltyPointExpiryService loyaltyPointExpiryService;
        @Mock private WashHistoryService washHistoryService;
        @Mock private PromotionService promotionService;
        @Mock private NotificationService notificationService;
        @Mock private EmailService emailService;
        @Mock private BookingReviewService bookingReviewService;
        @Mock private StaffOperationAccessPolicy staffOperationAccessPolicy;

        @InjectMocks private BookingServiceImpl bookingService;

        @BeforeEach
        void setUp() {
            lenient().when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(anyLong(), any(), anyLong()))
                    .thenReturn(null);
            lenient().when(bookingAddOnServicePackageRepository.findByBookingIdOrderBySortOrderAsc(anyLong()))
                    .thenReturn(List.of());
            lenient().when(bookingAssignedStaffRepository.findByBookingId(anyLong()))
                    .thenReturn(List.of());
            lenient().when(pointTransactionRepository.findByBookingIdAndType(anyLong(), eq("EARN")))
                    .thenReturn(Optional.empty());
            lenient().when(bookingRepository.save(any(Booking.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
        }

        /**
         * Test 15: markBookingPaid with CASH method on a COMPLETED booking succeeds
         * and sets paymentStatus=PAID without touching deposit fields.
         */
        @Test
        void test15_markBookingPaid_cashMethod_on_completedBooking_succeeds() {
            User staff = TestFixtures.staff();
            StaffProfile staffProfile = TestFixtures.customerServiceStaff(staff, TestFixtures.garage());
            Booking booking = completedBookingWithDepositPaid();

            when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
            when(staffProfileRepository.findByUser_Id(staff.getId())).thenReturn(Optional.of(staffProfile));

            MarkBookingPaidRequest req = new MarkBookingPaidRequest();
            req.setPaymentMethod("CASH");

            bookingService.markBookingPaid(booking.getId(), staff.getId(), "ROLE_STAFF", req);

            ArgumentCaptor<Booking> captor = ArgumentCaptor.forClass(Booking.class);
            verify(bookingRepository).save(captor.capture());
            Booking saved = captor.getValue();

            assertEquals("PAID", saved.getPaymentStatus(), "paymentStatus must be PAID after cash collection");
            assertNotNull(saved.getPaidAt(), "paidAt must be set after cash collection");
            // Deposit fields must NOT be changed by markBookingPaid
            assertEquals("PAID", saved.getDepositStatus(),
                    "depositStatus must remain PAID (not changed by markBookingPaid)");
            assertEquals(booking.getDepositPaidAt(), saved.getDepositPaidAt(),
                    "depositPaidAt must not be changed by markBookingPaid");
        }

        /**
         * Test 16: markBookingPaid with PAYOS method → 400 (only CASH is accepted).
         */
        @Test
        void test16_markBookingPaid_payosMethod_throws400() {
            User staff = TestFixtures.staff();
            StaffProfile staffProfile = TestFixtures.customerServiceStaff(staff, TestFixtures.garage());
            Booking booking = completedBookingWithDepositPaid();

            when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
            when(staffProfileRepository.findByUser_Id(staff.getId())).thenReturn(Optional.of(staffProfile));

            MarkBookingPaidRequest req = new MarkBookingPaidRequest();
            req.setPaymentMethod("PAYOS");

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.markBookingPaid(booking.getId(), staff.getId(), "ROLE_STAFF", req));

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode(),
                    "markBookingPaid must reject PAYOS payment method with 400");
        }

        /**
         * Test 17: markBookingPaid on an already-paid booking → 400.
         */
        @Test
        void test17_markBookingPaid_alreadyPaid_throws400() {
            User staff = TestFixtures.staff();
            StaffProfile staffProfile = TestFixtures.customerServiceStaff(staff, TestFixtures.garage());
            Booking booking = completedBookingWithDepositPaid();
            booking.setPaymentStatus("PAID"); // already fully paid

            when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
            when(staffProfileRepository.findByUser_Id(staff.getId())).thenReturn(Optional.of(staffProfile));

            MarkBookingPaidRequest req = new MarkBookingPaidRequest();
            req.setPaymentMethod("CASH");

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.markBookingPaid(booking.getId(), staff.getId(), "ROLE_STAFF", req));

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode(),
                    "markBookingPaid must reject already-paid booking with 400");
        }

        // ── helpers ──────────────────────────────────────────────────────────

        private Booking completedBookingWithDepositPaid() {
            User customer = TestFixtures.customer();
            Vehicle vehicle = TestFixtures.car(customer);
            ServicePackage pkg = TestFixtures.carWashPackage();
            Booking b = TestFixtures.confirmedBooking(customer, vehicle, TestFixtures.garage(), pkg);
            b.setId(40L);
            b.setGarageId(1L); // matches staffProfile.garageId from TestFixtures
            b.setStatus("COMPLETED");
            b.setPaymentStatus("UNPAID");
            b.setFinalPrice(new BigDecimal("120000.00"));
            b.setDepositAmount(new BigDecimal("36000.00"));
            b.setDepositStatus("PAID");
            b.setDepositPaidAt(LocalDateTime.of(2026, 7, 10, 9, 0));
            b.setDepositTransactionId(50L);
            return b;
        }
    }
}
