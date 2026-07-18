package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CreatePayOSPaymentRequest;
import com.autowashpro.dto.response.CreatePayOSPaymentResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.PaymentTransaction;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.PaymentTransactionRepository;
import com.autowashpro.service.EmailService;
import com.autowashpro.service.AuditLogService;
import com.autowashpro.service.LoyaltyService;
import com.autowashpro.service.NotificationService;
import com.autowashpro.service.WashHistoryService;
import com.autowashpro.support.TestFixtures;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
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
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentServiceImplTest {

    @Mock
    private PayOS payOS;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private PaymentTransactionRepository transactionRepository;

    @Mock
    private LoyaltyService loyaltyService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private WashHistoryService washHistoryService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private EmailService emailService;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private PlatformTransactionManager transactionManager;

    @InjectMocks
    private PaymentServiceImpl paymentService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(paymentService, "returnUrl", "https://app.test/payments/return");
        ReflectionTestUtils.setField(paymentService, "cancelUrl", "https://app.test/payments/cancel");
        ReflectionTestUtils.setField(paymentService, "clientId", "client-id");
        ReflectionTestUtils.setField(paymentService, "apiKey", "api-key");
        ReflectionTestUtils.setField(paymentService, "payosApiUrl", "https://api-merchant.payos.vn/v2/payment-requests");
        ReflectionTestUtils.setField(paymentService, "checksumKey", "checksum-key");
        lenient().when(transactionManager.getTransaction(any(TransactionDefinition.class)))
                .thenReturn(new SimpleTransactionStatus());
        lenient().when(transactionRepository.save(any(PaymentTransaction.class))).thenAnswer(invocation -> {
            PaymentTransaction transaction = invocation.getArgument(0);
            if (transaction.getId() == null) {
                transaction.setId(99L);
            }
            return transaction;
        });
        lenient().when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createPayOSPaymentRejectsBookingThatIsNotCompleted() {
        Booking booking = completedBooking();
        booking.setStatus("IN_PROGRESS");
        CreatePayOSPaymentRequest request = paymentRequest(booking.getId());
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> paymentService.createPayOSPayment(request, 2L));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(restTemplate, never()).postForEntity(any(String.class), any(), eq(Map.class));
        verify(transactionRepository, never()).save(any());
    }

    @Test
    void createPayOSPaymentRejectsAlreadyPaidBooking() {
        Booking booking = completedBooking();
        booking.setPaymentStatus("PAID");
        CreatePayOSPaymentRequest request = paymentRequest(booking.getId());
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> paymentService.createPayOSPayment(request, 2L));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(restTemplate, never()).postForEntity(any(String.class), any(), eq(Map.class));
    }

    @Test
    void createPayOSPaymentPostsRequestAndSavesPendingTransaction() {
        Booking booking = pendingDepositBooking();
        CreatePayOSPaymentRequest request = paymentRequest(booking.getId());
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(restTemplate.postForEntity(
                eq("https://api-merchant.payos.vn/v2/payment-requests"),
                any(HttpEntity.class),
                eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of(
                        "data", Map.of(
                                "checkoutUrl", "https://pay.payos.vn/web/abc",
                                "qrCode", "qr-data"))));
        ArgumentCaptor<HttpEntity<Map<String, Object>>> httpEntityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        ArgumentCaptor<PaymentTransaction> transactionCaptor = ArgumentCaptor.forClass(PaymentTransaction.class);

        CreatePayOSPaymentResponse response = paymentService.createPayOSPayment(request, 2L);

        assertEquals(99L, response.getTransactionId());
        assertEquals("PENDING", response.getStatus());
        assertEquals("https://pay.payos.vn/web/abc", response.getCheckoutUrl());
        verify(restTemplate).postForEntity(
                eq("https://api-merchant.payos.vn/v2/payment-requests"),
                httpEntityCaptor.capture(),
                eq(Map.class));
        HttpEntity<Map<String, Object>> httpEntity = httpEntityCaptor.getValue();
        assertEquals("client-id", httpEntity.getHeaders().getFirst("x-client-id"));
        assertEquals("api-key", httpEntity.getHeaders().getFirst("x-api-key"));
        assertEquals(booking.getDepositAmount().intValue(), httpEntity.getBody().get("amount"));
        assertEquals("DH#" + booking.getId(), httpEntity.getBody().get("description"));
        assertNotNull(httpEntity.getBody().get("signature"));
        verify(transactionRepository).save(transactionCaptor.capture());
        PaymentTransaction saved = transactionCaptor.getValue();
        assertEquals(booking.getId(), saved.getBookingId());
        assertEquals("PAYOS", saved.getPaymentMethod());
        assertEquals("PENDING", saved.getStatus());
        assertEquals(booking.getDepositAmount(), saved.getAmount());
        assertEquals(response.getOrderCode(), saved.getOrderCode());
    }

    @Test
    void handlePayOSWebhookSuccessMarksTransactionAndBookingPaid() throws Exception {
        Booking booking = completedBooking();
        PaymentTransaction transaction = pendingTransaction(booking);
        when(payOS.verifyPaymentWebhookData(any(Webhook.class))).thenReturn(webhookData(transaction.getOrderCode(), "00"));
        when(transactionRepository.findByOrderCode(transaction.getOrderCode())).thenReturn(Optional.of(transaction));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        paymentService.handlePayOSWebhook(webhookPayload(transaction.getOrderCode(), "00"));

        assertEquals("PAID", transaction.getStatus());
        assertNotNull(transaction.getPaidAt());
        assertEquals("payment-link-123", transaction.getPayosTransactionId());
        assertEquals("PAID", booking.getPaymentStatus());
        assertEquals("PAYOS", booking.getPaymentMethod());
        assertNotNull(booking.getPaidAt());
        verify(transactionRepository).save(transaction);
        verify(bookingRepository).save(booking);
        verify(loyaltyService).updateBookingStatistics(booking.getId());
        verify(loyaltyService).earnPointsAfterPaidBooking(booking.getId());
        verify(washHistoryService).createWashHistoryAfterPaidBooking(booking.getId());
        verify(notificationService).notifyPaymentConfirmed(booking.getId());
        verify(notificationService).notifyRewardEarned(booking.getId());
    }

    @Test
    void handlePayOSWebhookFailureCancelsPendingTransaction() throws Exception {
        Booking booking = completedBooking();
        PaymentTransaction transaction = pendingTransaction(booking);
        when(payOS.verifyPaymentWebhookData(any(Webhook.class))).thenReturn(webhookData(transaction.getOrderCode(), "01"));
        when(transactionRepository.findByOrderCode(transaction.getOrderCode())).thenReturn(Optional.of(transaction));

        paymentService.handlePayOSWebhook(webhookPayload(transaction.getOrderCode(), "01"));

        assertEquals("CANCELLED", transaction.getStatus());
        assertEquals("PayOS code: 01", transaction.getCancelReason());
        verify(transactionRepository).save(transaction);
        verify(bookingRepository, never()).save(any());
        verify(loyaltyService, never()).earnPointsAfterPaidBooking(any());
        verify(washHistoryService, never()).createWashHistoryAfterPaidBooking(any());
    }

    @Test
    void handlePayOSWebhookIgnoresAlreadyProcessedTransaction() throws Exception {
        Booking booking = completedBooking();
        PaymentTransaction transaction = pendingTransaction(booking);
        transaction.setStatus("PAID");
        when(payOS.verifyPaymentWebhookData(any(Webhook.class))).thenReturn(webhookData(transaction.getOrderCode(), "00"));
        when(transactionRepository.findByOrderCode(transaction.getOrderCode())).thenReturn(Optional.of(transaction));

        paymentService.handlePayOSWebhook(webhookPayload(transaction.getOrderCode(), "00"));

        verify(transactionRepository, never()).save(any());
        verify(bookingRepository, never()).save(any());
        verify(loyaltyService, never()).earnPointsAfterPaidBooking(any());
        verify(washHistoryService, never()).createWashHistoryAfterPaidBooking(any());
    }

    @Test
    void handlePayOSWebhookDoesNotReprocessAlreadyPaidBooking() throws Exception {
        Booking booking = completedBooking();
        booking.setPaymentStatus("PAID");
        PaymentTransaction transaction = pendingTransaction(booking);
        when(payOS.verifyPaymentWebhookData(any(Webhook.class))).thenReturn(webhookData(transaction.getOrderCode(), "00"));
        when(transactionRepository.findByOrderCode(transaction.getOrderCode())).thenReturn(Optional.of(transaction));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        paymentService.handlePayOSWebhook(webhookPayload(transaction.getOrderCode(), "00"));

        assertEquals("PAID", transaction.getStatus());
        verify(transactionRepository).save(transaction);
        verify(bookingRepository, never()).save(booking);
        verify(loyaltyService, never()).earnPointsAfterPaidBooking(any());
        verify(washHistoryService, never()).createWashHistoryAfterPaidBooking(any());
    }

    private CreatePayOSPaymentRequest paymentRequest(Long bookingId) {
        CreatePayOSPaymentRequest request = new CreatePayOSPaymentRequest();
        request.setBookingId(bookingId);
        return request;
    }

    private Booking completedBooking() {
        User customer = TestFixtures.customer();
        Vehicle vehicle = TestFixtures.car(customer);
        ServicePackage servicePackage = TestFixtures.carWashPackage();
        Booking booking = TestFixtures.confirmedBooking(customer, vehicle, TestFixtures.garage(), servicePackage);
        booking.setId(20L);
        booking.setStatus("COMPLETED");
        booking.setPaymentStatus("UNPAID");
        booking.setCompletedAt(TestFixtures.BASE_TIME.plusHours(1));
        booking.setFinalPrice(new BigDecimal("120000.00"));
        return booking;
    }

    private Booking pendingDepositBooking() {
        Booking booking = completedBooking();
        booking.setStatus("PENDING_DEPOSIT");
        booking.setPaymentStatus("UNPAID");
        booking.setDepositAmount(new BigDecimal("36000.00"));
        booking.setDepositStatus("UNPAID");
        return booking;
    }

    private PaymentTransaction pendingTransaction(Booking booking) {
        PaymentTransaction transaction = new PaymentTransaction();
        transaction.setId(50L);
        transaction.setBookingId(booking.getId());
        transaction.setPaymentMethod("PAYOS");
        transaction.setAmount(booking.getDepositAmount());
        transaction.setStatus("PENDING");
        transaction.setOrderCode(987654321L);
        transaction.setCheckoutUrl("https://pay.payos.vn/web/abc");
        transaction.setQrCode("qr-data");
        return transaction;
    }

    private WebhookData webhookData(Long orderCode, String code) {
        return WebhookData.builder()
                .orderCode(orderCode)
                .amount(120000)
                .description("DH#20")
                .accountNumber("123456789")
                .reference("FT123456")
                .transactionDateTime("2026-07-06 10:00:00")
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
        data.put("amount", 120000);
        data.put("description", "DH#20");
        data.put("accountNumber", "123456789");
        data.put("reference", "FT123456");
        data.put("transactionDateTime", "2026-07-06 10:00:00");
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
