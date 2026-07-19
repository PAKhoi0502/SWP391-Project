package com.autowashpro.service.impl;

import com.autowashpro.common.AuditAction;
import com.autowashpro.common.AuditMetadata;
import com.autowashpro.common.AuditTargetType;

import com.autowashpro.service.WashHistoryService;
import com.autowashpro.service.AuditLogService;
import com.autowashpro.dto.request.CreatePayOSPaymentRequest;
import com.autowashpro.dto.response.CreatePayOSPaymentResponse;
import com.autowashpro.dto.response.PaymentTransactionResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.PaymentTransaction;
import com.autowashpro.entity.PromotionUsage;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.PaymentTransactionRepository;
import com.autowashpro.repository.PromotionRepository;
import com.autowashpro.repository.PromotionUsageRepository;
import com.autowashpro.service.EmailService;
import com.autowashpro.service.LoyaltyService;
import com.autowashpro.service.NotificationService;
import com.autowashpro.service.PaymentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
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
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {

    private final PayOS payOS;
    private final BookingRepository bookingRepository;
    private final PaymentTransactionRepository transactionRepository;
    private final LoyaltyService loyaltyService;
    private final PromotionRepository promotionRepository;

    private final PromotionUsageRepository promotionUsageRepository;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final WashHistoryService washHistoryService;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final com.autowashpro.service.BookingReviewService bookingReviewService;
    private final EmailService emailService;
    private final org.springframework.transaction.PlatformTransactionManager transactionManager;

    @Value("${payos.return-url}")
    private String returnUrl;

    @Value("${payos.cancel-url}")
    private String cancelUrl;

    @Value("${payos.client-id}")
    private String clientId;

    @Value("${payos.api-key}")
    private String apiKey;

    @Value("${payos.payment-api-url}")
    private String payosApiUrl;

    @Value("${payos.checksum-key}")
    private String checksumKey;

    @Override
    @Transactional
    public CreatePayOSPaymentResponse createPayOSPayment(CreatePayOSPaymentRequest request, Long staffUserId) {

        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Booking not found: " + request.getBookingId()));

        if (!"PENDING_DEPOSIT".equals(booking.getStatus())) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "PayOS payment can only be created for PENDING_DEPOSIT booking. Current status: "
                            + booking.getStatus());

        }

        if ("PAID".equals(booking.getPaymentStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking has already been paid");
        }

        transactionRepository
                .findByBookingIdAndStatus(
                        request.getBookingId(),
                        "PENDING")
                .ifPresent(existing -> {

                    existing.setStatus("EXPIRED");

                    existing.setCancelReason(
                            "Re-created payment link");

                    transactionRepository.save(existing);

                });

        // A previous attempt may have left depositStatus stuck on CANCELED/FAILED/EXPIRED
        // (e.g. customer cancelled a QR then re-opened one) — reset it since this fresh
        // payment link is now the active one awaiting payment.
        if (!"PAID".equals(booking.getDepositStatus())) {
            booking.setDepositStatus("UNPAID");
            bookingRepository.save(booking);
        }

        long orderCode = System.currentTimeMillis() % 1_000_000_000L;

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("x-client-id", clientId);
            headers.set("x-api-key", apiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);

            String sigData = "amount=" + booking.getDepositAmount().intValue() +
                    "&cancelUrl=" + cancelUrl +
                    "&description=DH#" + booking.getId() +
                    "&orderCode=" + orderCode +
                    "&returnUrl=" + returnUrl;

            String signature = hmacSHA256(sigData, checksumKey);

            Map<String, Object> body = new HashMap<>();
            body.put("orderCode", orderCode);
            body.put("amount", booking.getDepositAmount().intValue());
            body.put("description", "DH#" + booking.getId());
            body.put("returnUrl", returnUrl);
            body.put("cancelUrl", cancelUrl);
            body.put("signature", signature);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            ResponseEntity<Map> apiResponse = restTemplate.postForEntity(
                    payosApiUrl,
                    entity,
                    Map.class);

            log.info("PayOS response status: {}", apiResponse.getStatusCode());
            log.info("PayOS response body: {}", apiResponse.getBody());

            Map<String, Object> responseData = (Map<String, Object>) apiResponse.getBody().get("data");
            String checkoutUrl = (String) responseData.get("checkoutUrl");
            String qrCode = (String) responseData.get("qrCode");

            PaymentTransaction transaction = new PaymentTransaction();
            transaction.setBookingId(booking.getId());
            transaction.setPaymentMethod("PAYOS");
            transaction.setPurpose("DEPOSIT");
            transaction.setAmount(booking.getDepositAmount());
            transaction.setStatus("PENDING");
            transaction.setOrderCode(orderCode);
            transaction.setCheckoutUrl(checkoutUrl);
            transaction.setQrCode(qrCode);
            transaction.setExpiredAt(LocalDateTime.now().plusMinutes(15));

            PaymentTransaction saved = transactionRepository.save(transaction);

            return CreatePayOSPaymentResponse.builder()
                    .transactionId(saved.getId())
                    .orderCode(orderCode)
                    .checkoutUrl(checkoutUrl)
                    .qrCode(qrCode)
                    .status("PENDING")
                    .build();

        } catch (Exception e) {
            log.error("PayOS error: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to create PayOS payment: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public CreatePayOSPaymentResponse createPayOSPaymentForCustomer(CreatePayOSPaymentRequest request, Long customerId) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Booking not found: " + request.getBookingId()));

        if (booking.getCustomerId() == null || !booking.getCustomerId().equals(customerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This booking does not belong to you");
        }

        return createPayOSPayment(request, customerId);
    }

    @Override
    @Transactional
    public CreatePayOSPaymentResponse createPayOSPaymentForGuest(Long bookingId) {
        CreatePayOSPaymentRequest request = new CreatePayOSPaymentRequest();
        request.setBookingId(bookingId);
        return createPayOSPayment(request, null);
    }

    @Override
    public List<PaymentTransactionResponse> getTransactionsByBookingForCustomer(Long bookingId, Long customerId, String purpose) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Booking not found: " + bookingId));

        if (booking.getCustomerId() == null || !booking.getCustomerId().equals(customerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This booking does not belong to you");
        }

        List<PaymentTransaction> transactions = (purpose == null || purpose.isBlank())
                ? transactionRepository.findByBookingIdOrderByCreatedAtDesc(bookingId)
                : transactionRepository.findByBookingIdAndPurposeOrderByCreatedAtDesc(bookingId, purpose.toUpperCase());

        return transactions.stream().map(this::toResponse).collect(Collectors.toList());
    }

    private void assertTransactionOwnedByCustomer(PaymentTransaction transaction, Long customerId) {
        Booking booking = bookingRepository.findById(transaction.getBookingId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        if (booking.getCustomerId() == null || !booking.getCustomerId().equals(customerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This transaction does not belong to you");
        }
    }

    @Override
    public PaymentTransactionResponse getTransactionByIdForCustomer(Long id, Long customerId) {
        PaymentTransaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Transaction not found: " + id));
        assertTransactionOwnedByCustomer(transaction, customerId);
        return toResponse(transaction);
    }

    @Override
    @Transactional
    public PaymentTransactionResponse cancelTransactionForCustomer(Long id, Long customerId) {
        PaymentTransaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Transaction not found: " + id));
        assertTransactionOwnedByCustomer(transaction, customerId);

        if (!"PENDING".equals(transaction.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only PENDING transaction can be cancelled. Current status: " + transaction.getStatus());
        }

        try {
            payOS.cancelPaymentLink(transaction.getOrderCode(), "Cancelled by customer");
        } catch (Exception e) {
            log.warn("PayOS cancel failed: {}", e.getMessage());
        }

        transaction.setStatus("CANCELLED");
        transaction.setCancelReason("Cancelled by customer");
        PaymentTransaction saved = transactionRepository.save(transaction);

        if ("DEPOSIT".equals(transaction.getPurpose())) {
            bookingRepository.findById(transaction.getBookingId()).ifPresent(booking -> {
                booking.setDepositStatus("CANCELED");
                bookingRepository.save(booking);
            });
        }

        return toResponse(saved);
    }

    @Override
    public void handlePayOSWebhook(Map<String, Object> webhookData) {
        try {
            Webhook webhookBody = objectMapper.convertValue(webhookData, Webhook.class);
            WebhookData data = payOS.verifyPaymentWebhookData(webhookBody);

            Long orderCode = data.getOrderCode();
            String code = data.getCode();

            Optional<PaymentTransaction> transactionOpt = transactionRepository.findByOrderCode(orderCode);
            if (transactionOpt.isEmpty()) {
                log.info("Test webhook received for orderCode: {}, ignoring", orderCode);
                return;
            }
            PaymentTransaction transaction = transactionOpt.get();

            if (!"PENDING".equals(transaction.getStatus())) {
                log.info("Transaction {} already processed with status {}", orderCode, transaction.getStatus());
                return;
            }

            if ("00".equals(code)) {
                final long[] bookingIdRef = { 0 };

                // Commit payment in its own transaction so a loyalty failure cannot roll it back
                new org.springframework.transaction.support.TransactionTemplate(transactionManager).execute(status -> {
                    transaction.setStatus("PAID");
                    transaction.setPaidAt(LocalDateTime.now());
                    transaction.setPayosTransactionId(String.valueOf(data.getPaymentLinkId()));
                    transactionRepository.save(transaction);

                    Booking booking = bookingRepository.findById(transaction.getBookingId())
                            .orElseThrow(() -> new RuntimeException("Booking not found"));

                    if (!"PAID".equals(booking.getPaymentStatus())) {

                        booking.setStatus("CONFIRMED");

                        booking.setDepositStatus("PAID");
                        booking.setDepositPaidAt(LocalDateTime.now());
                        booking.setDepositTransactionId(transaction.getId());

                        booking.setPaymentStatus("PAID");

                        booking.setPaymentMethod("PAYOS");

                        booking.setPaidAt(LocalDateTime.now());
                        if (booking.getPromotionId() != null
                                && !promotionUsageRepository.existsByBookingId(
                                        booking.getId())) {

                            PromotionUsage usage = new PromotionUsage();

                            usage.setPromotionId(
                                    booking.getPromotionId());

                            usage.setBookingId(
                                    booking.getId());

                            usage.setCustomerId(
                                    booking.getCustomerId());

                            usage.setDiscountAmount(
                                    booking.getPromotionDiscountAmount());

                            usage.setUsedAt(
                                    LocalDateTime.now());

                            promotionUsageRepository.save(
                                    usage);

                            promotionRepository.findById(
                                    booking.getPromotionId())
                                    .ifPresent(promotion -> {

                                        promotion.setUsedCount(
                                                promotion.getUsedCount() + 1);

                                        promotionRepository.save(
                                                promotion);

                                    });

                        }

                        bookingRepository.save(booking);
                        bookingIdRef[0] = booking.getId();

                    }
                    auditLogService.createAuditLog(
                            null,
                            AuditAction.PAYMENT_CONFIRMED,
                            AuditTargetType.PAYMENT_TRANSACTION,
                            transaction.getId(),
                            AuditMetadata.of("bookingId", booking.getId(), "status", transaction.getStatus()));
                    return null;
                });

                // Post-payment chain runs after payment is committed — failures are logged but
                // do not roll back the payment. Missing points are covered by
                // backfillMissingEarnPoints.
                long bookingId = bookingIdRef[0];
                if (bookingId != 0) {
                    try {
                        loyaltyService.updateBookingStatistics(bookingId);
                        loyaltyService.earnPointsAfterPaidBooking(bookingId);
                        washHistoryService.createWashHistoryAfterPaidBooking(bookingId);
                        notificationService.notifyBookingConfirmed(
                                bookingId);
                        notificationService.notifyPaymentConfirmed(bookingId);
                        notificationService.notifyRewardEarned(bookingId);
                        bookingReviewService.maybeCreateReviewRequestNotification(bookingId);
                    } catch (Exception e) {
                        log.error("Post-payment processing failed for booking {}: {}", bookingId, e.getMessage());
                    }
                }
            } else {
                new org.springframework.transaction.support.TransactionTemplate(transactionManager).execute(status -> {
                    transaction.setStatus("CANCELLED");
                    transaction.setCancelReason("PayOS code: " + code);
                    transactionRepository.save(transaction);

                    bookingRepository.findById(transaction.getBookingId()).ifPresent(booking -> {
                        if (!"PAID".equals(booking.getDepositStatus())) {
                            booking.setDepositStatus("CANCELED");
                            bookingRepository.save(booking);
                        }
                    });

                    auditLogService.createAuditLog(
                            null,
                            AuditAction.PAYMENT_FAILED,
                            AuditTargetType.PAYMENT_TRANSACTION,
                            transaction.getId(),
                            AuditMetadata.of("bookingId", transaction.getBookingId(), "status", transaction.getStatus(),
                                    "code", code));
                    return null;
                });
            }

        } catch (Exception e) {
            log.error("Webhook processing error: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid webhook data: " + e.getMessage());
        }
    }

    @Override
    public PaymentTransactionResponse getTransactionById(Long id) {
        PaymentTransaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Transaction not found: " + id));
        return toResponse(transaction);
    }

    @Override
    public List<PaymentTransactionResponse> getTransactionsByBooking(Long bookingId) {
        bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Booking not found: " + bookingId));
        return transactionRepository.findByBookingIdOrderByCreatedAtDesc(bookingId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public PaymentTransactionResponse cancelTransaction(Long id, Long staffUserId) {
        PaymentTransaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Transaction not found: " + id));

        if (!"PENDING".equals(transaction.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only PENDING transaction can be cancelled. Current status: " + transaction.getStatus());
        }

        try {
            payOS.cancelPaymentLink(transaction.getOrderCode(), "Cancelled by staff");
        } catch (Exception e) {
            log.warn("PayOS cancel failed: {}", e.getMessage());
        }

        transaction.setStatus("CANCELLED");
        transaction.setCancelReason("Cancelled by staff");
        PaymentTransaction saved = transactionRepository.save(transaction);
        return toResponse(saved);
    }

    private PaymentTransactionResponse toResponse(PaymentTransaction t) {
        return PaymentTransactionResponse.builder()
                .id(t.getId())
                .bookingId(t.getBookingId())
                .paymentMethod(t.getPaymentMethod())
                .amount(t.getAmount())
                .status(t.getStatus())
                .orderCode(t.getOrderCode())
                .checkoutUrl(t.getCheckoutUrl())
                .qrCode(t.getQrCode())
                .cancelReason(t.getCancelReason())
                .paidAt(t.getPaidAt())
                .expiredAt(t.getExpiredAt())
                .createdAt(t.getCreatedAt())
                .build();
    }

    private String hmacSHA256(String data, String key) throws Exception {
        javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
        javax.crypto.spec.SecretKeySpec secretKey = new javax.crypto.spec.SecretKeySpec(key.getBytes("UTF-8"),
                "HmacSHA256");
        mac.init(secretKey);
        byte[] hash = mac.doFinal(data.getBytes("UTF-8"));
        StringBuilder hexString = new StringBuilder();
        for (byte b : hash) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1)
                hexString.append('0');
            hexString.append(hex);
        }
        return hexString.toString();
    }
}
