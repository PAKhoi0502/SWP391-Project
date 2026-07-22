package com.autowashpro.service.impl;

import com.autowashpro.dto.response.PaymentTransactionResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.PaymentTransaction;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.entity.VehicleInspection;
import com.autowashpro.entity.enums.StaffType;
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
import com.autowashpro.service.support.InspectionAccessPolicy;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import vn.payos.PayOS;
import vn.payos.type.Webhook;
import vn.payos.type.WebhookData;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression tests for the deposit-paid-as-full-payment bug and the
 * BEFORE_WASH inspection requirement for startWash.
 */
class PaymentDepositBugTest {

    // =====================================================================
    // 1-4, 8: PaymentServiceImpl — deposit webhook behaviour
    // =====================================================================
    @Nested
    @ExtendWith(MockitoExtension.class)
    @MockitoSettings(strictness = Strictness.LENIENT)
    class DepositWebhookTests {

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
        @Mock private StaffOperationAccessPolicy staffOperationAccessPolicy;

        @InjectMocks private PaymentServiceImpl paymentService;

        @BeforeEach
        void setUp() {
            lenient().when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(anyLong(), any(), anyLong()))
                    .thenReturn(null);
            lenient().when(transactionManager.getTransaction(any(TransactionDefinition.class)))
                    .thenReturn(new SimpleTransactionStatus());
            lenient().when(transactionRepository.save(any(PaymentTransaction.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            lenient().when(bookingRepository.save(any(Booking.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
        }

        // ------------------------------------------------------------------
        // Test 1: deposit webhook sets depositStatus=PAID but NOT paymentStatus=PAID
        // ------------------------------------------------------------------
        @Test
        void depositWebhook_setsDepositPaid_notPaymentPaid() throws Exception {
            Booking booking = pendingDepositBooking();
            PaymentTransaction transaction = depositTransaction(booking);
            when(payOS.verifyPaymentWebhookData(any(Webhook.class)))
                    .thenReturn(webhookData(transaction.getOrderCode(), "00"));
            when(transactionRepository.findByOrderCode(transaction.getOrderCode()))
                    .thenReturn(Optional.of(transaction));
            when(bookingRepository.findById(booking.getId()))
                    .thenReturn(Optional.of(booking));

            paymentService.handlePayOSWebhook(webhookPayload(transaction.getOrderCode(), "00"));

            ArgumentCaptor<Booking> bookingCaptor = ArgumentCaptor.forClass(Booking.class);
            verify(bookingRepository).save(bookingCaptor.capture());
            Booking saved = bookingCaptor.getValue();

            assertEquals("PAID", saved.getDepositStatus());
            assertEquals("UNPAID", saved.getPaymentStatus(),
                    "paymentStatus must NOT be PAID after a DEPOSIT webhook");
            assertNull(saved.getPaidAt(), "paidAt must NOT be set after a DEPOSIT webhook");
            assertNotNull(saved.getDepositPaidAt());
        }

        // ------------------------------------------------------------------
        // Test 2: deposit webhook does NOT call earnPointsAfterPaidBooking
        // ------------------------------------------------------------------
        @Test
        void depositWebhook_doesNotEarnPoints() throws Exception {
            Booking booking = pendingDepositBooking();
            PaymentTransaction transaction = depositTransaction(booking);
            when(payOS.verifyPaymentWebhookData(any(Webhook.class)))
                    .thenReturn(webhookData(transaction.getOrderCode(), "00"));
            when(transactionRepository.findByOrderCode(transaction.getOrderCode()))
                    .thenReturn(Optional.of(transaction));
            when(bookingRepository.findById(booking.getId()))
                    .thenReturn(Optional.of(booking));

            paymentService.handlePayOSWebhook(webhookPayload(transaction.getOrderCode(), "00"));

            verify(loyaltyService, never()).earnPointsAfterPaidBooking(anyLong());
            verify(washHistoryService, never()).createWashHistoryAfterPaidBooking(anyLong());
            verify(bookingReviewService, never()).maybeCreateReviewRequestNotification(anyLong());
            verify(notificationService, never()).notifyPaymentConfirmed(anyLong());
        }

        // ------------------------------------------------------------------
        // Test 3: duplicate deposit webhook is idempotent (no second save)
        // ------------------------------------------------------------------
        @Test
        void depositWebhook_idempotent() throws Exception {
            Booking booking = pendingDepositBooking();
            PaymentTransaction transaction = depositTransaction(booking);
            // Simulate already-processed: status is already PAID
            transaction.setStatus("PAID");
            when(payOS.verifyPaymentWebhookData(any(Webhook.class)))
                    .thenReturn(webhookData(transaction.getOrderCode(), "00"));
            when(transactionRepository.findByOrderCode(transaction.getOrderCode()))
                    .thenReturn(Optional.of(transaction));

            // First call
            paymentService.handlePayOSWebhook(webhookPayload(transaction.getOrderCode(), "00"));
            // Second call
            paymentService.handlePayOSWebhook(webhookPayload(transaction.getOrderCode(), "00"));

            // Because the status is already PAID, both calls are no-ops (early return).
            verify(transactionRepository, never()).save(any());
            verify(bookingRepository, never()).save(any());
            verify(loyaltyService, never()).earnPointsAfterPaidBooking(any());
        }

        // ------------------------------------------------------------------
        // Test 4: deposit webhook sets booking.status = CONFIRMED
        // ------------------------------------------------------------------
        @Test
        void depositWebhook_setsBookingConfirmed() throws Exception {
            Booking booking = pendingDepositBooking();
            PaymentTransaction transaction = depositTransaction(booking);
            when(payOS.verifyPaymentWebhookData(any(Webhook.class)))
                    .thenReturn(webhookData(transaction.getOrderCode(), "00"));
            when(transactionRepository.findByOrderCode(transaction.getOrderCode()))
                    .thenReturn(Optional.of(transaction));
            when(bookingRepository.findById(booking.getId()))
                    .thenReturn(Optional.of(booking));

            paymentService.handlePayOSWebhook(webhookPayload(transaction.getOrderCode(), "00"));

            ArgumentCaptor<Booking> captor = ArgumentCaptor.forClass(Booking.class);
            verify(bookingRepository).save(captor.capture());
            assertEquals("CONFIRMED", captor.getValue().getStatus());
        }

        // ------------------------------------------------------------------
        // Test 8: PaymentTransactionResponse includes the `purpose` field
        // ------------------------------------------------------------------
        @Test
        void paymentTransactionResponse_includesPurpose() {
            PaymentTransaction transaction = depositTransaction(pendingDepositBooking());
            transaction.setId(77L);

            when(transactionRepository.findById(77L)).thenReturn(Optional.of(transaction));
            when(bookingRepository.findById(transaction.getBookingId())).thenReturn(Optional.of(pendingDepositBooking()));

            PaymentTransactionResponse response = paymentService.getTransactionById(77L, 1L, "ROLE_ADMIN");

            assertNotNull(response.getPurpose(), "purpose field must not be null in the response");
            assertEquals("DEPOSIT", response.getPurpose());
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        private Booking pendingDepositBooking() {
            User customer = TestFixtures.customer();
            Vehicle vehicle = TestFixtures.car(customer);
            ServicePackage pkg = TestFixtures.carWashPackage();
            Booking booking = TestFixtures.confirmedBooking(customer, vehicle, TestFixtures.garage(), pkg);
            booking.setId(20L);
            booking.setStatus("PENDING_DEPOSIT");
            booking.setPaymentStatus("UNPAID");
            booking.setDepositAmount(new BigDecimal("36000.00"));
            booking.setDepositStatus("UNPAID");
            return booking;
        }

        private PaymentTransaction depositTransaction(Booking booking) {
            PaymentTransaction tx = new PaymentTransaction();
            tx.setId(50L);
            tx.setBookingId(booking.getId());
            tx.setPaymentMethod("PAYOS");
            tx.setPurpose("DEPOSIT");
            tx.setAmount(booking.getDepositAmount());
            tx.setStatus("PENDING");
            tx.setOrderCode(987654321L);
            tx.setCheckoutUrl("https://pay.payos.vn/web/abc");
            tx.setQrCode("qr-data");
            return tx;
        }

        private WebhookData webhookData(Long orderCode, String code) {
            return WebhookData.builder()
                    .orderCode(orderCode)
                    .amount(36000)
                    .description("DH#20")
                    .accountNumber("123456789")
                    .reference("FT123456")
                    .transactionDateTime("2026-07-19 10:00:00")
                    .currency("VND")
                    .paymentLinkId("payment-link-123")
                    .code(code)
                    .desc("Webhook")
                    .counterAccountBankId("970436")
                    .counterAccountBankName("Vietcombank")
                    .counterAccountName("Nguyen Van A")
                    .counterAccountNumber("987654321")
                    .virtualAccountName("AutoWashPro")
                    .virtualAccountNumber("111222333")
                    .build();
        }

        private Map<String, Object> webhookPayload(Long orderCode, String code) {
            Map<String, Object> data = new HashMap<>();
            data.put("orderCode", orderCode);
            data.put("amount", 36000);
            data.put("description", "DH#20");
            data.put("accountNumber", "123456789");
            data.put("reference", "FT123456");
            data.put("transactionDateTime", "2026-07-19 10:00:00");
            data.put("currency", "VND");
            data.put("paymentLinkId", "payment-link-123");
            data.put("code", code);
            data.put("desc", "Webhook");
            data.put("counterAccountBankId", "970436");
            data.put("counterAccountBankName", "Vietcombank");
            data.put("counterAccountName", "Nguyen Van A");
            data.put("counterAccountNumber", "987654321");
            data.put("virtualAccountName", "AutoWashPro");
            data.put("virtualAccountNumber", "111222333");

            Map<String, Object> payload = new HashMap<>();
            payload.put("code", code);
            payload.put("desc", "Webhook");
            payload.put("success", "00".equals(code));
            payload.put("signature", "signature");
            payload.put("data", data);
            return payload;
        }
    }

    // =====================================================================
    // 5, 6: BookingServiceImpl — startWash requires BEFORE_WASH inspection
    // =====================================================================
    @Nested
    @ExtendWith(MockitoExtension.class)
    @MockitoSettings(strictness = Strictness.LENIENT)
    class BeforeWashInspectionTests {

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

        @InjectMocks private BookingServiceImpl bookingService;

        @BeforeEach
        void setUp() {
            lenient().when(bookingAddOnServicePackageRepository.findByBookingIdOrderBySortOrderAsc(anyLong()))
                    .thenReturn(List.of());
            lenient().when(bookingAssignedStaffRepository.findByBookingId(anyLong()))
                    .thenReturn(List.of());
            lenient().when(pointTransactionRepository.findByBookingIdAndType(anyLong(), eq("EARN")))
                    .thenReturn(Optional.empty());
            lenient().when(bookingRepository.save(any(Booking.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
        }

        // ------------------------------------------------------------------
        // Test 5: startWash fails with 400 when BEFORE_WASH inspection is missing
        // ------------------------------------------------------------------
        @Test
        void beforeWash_missing_startWash_returns400() {
            User staff = TestFixtures.staff();
            Booking booking = checkedInWaitingForIntakeBooking();
            StaffProfile staffProfile = TestFixtures.customerServiceStaff(staff, TestFixtures.garage());

            when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
            when(staffProfileRepository.findByUser_Id(staff.getId())).thenReturn(Optional.of(staffProfile));
            // No BEFORE_WASH inspection
            when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                    .thenReturn(List.of());

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.startWash(booking.getId(), staff.getId(), "ROLE_STAFF", null));

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            // Message should mention BEFORE_WASH
            assert ex.getReason() != null && ex.getReason().contains("BEFORE_WASH") :
                    "Expected BEFORE_WASH in error message but got: " + ex.getReason();
        }

        // ------------------------------------------------------------------
        // Test 6: startWash succeeds when BEFORE_WASH inspection exists
        // ------------------------------------------------------------------
        @Test
        void beforeWash_present_startWash_succeeds() {
            User staff = TestFixtures.staff();
            Booking booking = checkedInWaitingForIntakeBooking();
            StaffProfile staffProfile = TestFixtures.customerServiceStaff(staff, TestFixtures.garage());
            ServicePackage pkg = TestFixtures.carWashPackage();
            pkg.setRequiresWashBay(false); // skip wash bay logic for simplicity

            VehicleInspection beforeWash = new VehicleInspection();
            beforeWash.setId(1L);
            beforeWash.setType("BEFORE_WASH");
            beforeWash.setBookingId(booking.getId());

            when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
            when(staffProfileRepository.findByUser_Id(staff.getId())).thenReturn(Optional.of(staffProfile));
            when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                    .thenReturn(List.of(beforeWash));
            when(servicePackageRepository.findById(booking.getServicePackageId())).thenReturn(Optional.of(pkg));
            when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                    .thenReturn(List.of());

            // Should not throw
            bookingService.startWash(booking.getId(), staff.getId(), "ROLE_STAFF", null);

            ArgumentCaptor<Booking> captor = ArgumentCaptor.forClass(Booking.class);
            verify(bookingRepository).save(captor.capture());
            assertEquals("IN_PROGRESS", captor.getValue().getStatus());
            assertEquals("AUTOMATED_WASH", captor.getValue().getOperationPhase());
        }

        // ------------------------------------------------------------------
        // Helpers
        // ------------------------------------------------------------------

        private Booking checkedInWaitingForIntakeBooking() {
            User customer = TestFixtures.customer();
            Vehicle vehicle = TestFixtures.car(customer);
            ServicePackage pkg = TestFixtures.carWashPackage();
            Booking booking = TestFixtures.confirmedBooking(customer, vehicle, TestFixtures.garage(), pkg);
            booking.setId(30L);
            booking.setStatus("CHECKED_IN");
            booking.setOperationPhase("WAITING_FOR_INTAKE");
            return booking;
        }
    }

    // =====================================================================
    // 7: InspectionAccessPolicy — VEHICLE_CARE_STAFF is denied
    // =====================================================================
    @Nested
    @ExtendWith(MockitoExtension.class)
    @MockitoSettings(strictness = Strictness.LENIENT)
    class InspectionAccessTests {

        @Mock private StaffProfileRepository staffProfileRepository;

        @InjectMocks private InspectionAccessPolicy inspectionAccessPolicy;

        // ------------------------------------------------------------------
        // Test 7: VEHICLE_CARE_STAFF gets 403 when trying to create an inspection
        // ------------------------------------------------------------------
        @Test
        void vehicleCareStaff_createInspection_returns403() {
            User careStaffUser = TestFixtures.staff();
            careStaffUser.setId(10L);

            Booking booking = new Booking();
            booking.setId(1L);
            booking.setGarageId(1L);

            StaffProfile careProfile = new StaffProfile();
            careProfile.setId(1L);
            careProfile.setUser(careStaffUser);
            careProfile.setGarageId(1L);
            careProfile.setStaffType(StaffType.VEHICLE_CARE_STAFF);
            careProfile.setIsActive(true);

            when(staffProfileRepository.findByUser_Id(careStaffUser.getId()))
                    .thenReturn(Optional.of(careProfile));

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> inspectionAccessPolicy.requireCanManage(booking, careStaffUser.getId(), "ROLE_STAFF"));

            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }
    }
}
