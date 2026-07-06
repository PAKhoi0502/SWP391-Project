package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.common.AuditAction;
import com.autowashpro.common.AuditMetadata;
import com.autowashpro.common.AuditTargetType;
import com.autowashpro.dto.request.CreatePayOSPaymentRequest;
import com.autowashpro.dto.response.CreatePayOSPaymentResponse;
import com.autowashpro.dto.response.PaymentTransactionResponse;
import com.autowashpro.service.PaymentService;
import com.autowashpro.service.AuditLogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import vn.payos.type.Webhook;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final AuditLogService auditLogService;

  @PostMapping("/payos/create")
@PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
public ApiResponse<CreatePayOSPaymentResponse> createPayOSPayment(
        @Valid @RequestBody CreatePayOSPaymentRequest request,
        @AuthenticationPrincipal UserDetails userDetails) {

    Long staffUserId = Long.valueOf(userDetails.getUsername());
    CreatePayOSPaymentResponse response = paymentService.createPayOSPayment(request, staffUserId);
    auditLogService.createAuditLog(
            staffUserId,
            AuditAction.PAYMENT_LINK_CREATED,
            AuditTargetType.PAYMENT_TRANSACTION,
            response.getTransactionId(),
            AuditMetadata.of("bookingId", request.getBookingId(), "status", response.getStatus()));
    return ApiResponse.<CreatePayOSPaymentResponse>builder()
            .success(true)
            .message("PayOS payment link created successfully")
            .data(response)
            .build();
}

@PostMapping("/payos/webhook")
public ApiResponse<Void> handleWebhook(@RequestBody Map<String, Object> webhookData) {
    paymentService.handlePayOSWebhook(webhookData);
    return ApiResponse.<Void>builder()
            .success(true)
            .message("Webhook processed successfully")
            .build();
}

    @GetMapping("/transactions/{id}")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public ApiResponse<PaymentTransactionResponse> getTransactionById(@PathVariable Long id) {
        return ApiResponse.<PaymentTransactionResponse>builder()
                .success(true)
                .message("Transaction retrieved")
                .data(paymentService.getTransactionById(id))
                .build();
    }

    @GetMapping("/bookings/{bookingId}/payment-transactions")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public ApiResponse<List<PaymentTransactionResponse>> getTransactionsByBooking(
            @PathVariable Long bookingId) {
        return ApiResponse.<List<PaymentTransactionResponse>>builder()
                .success(true)
                .message("Transactions retrieved")
                .data(paymentService.getTransactionsByBooking(bookingId))
                .build();
    }

    @PatchMapping("/transactions/{id}/cancel")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public ApiResponse<PaymentTransactionResponse> cancelTransaction(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {

        Long staffUserId = Long.valueOf(userDetails.getUsername());
        PaymentTransactionResponse response = paymentService.cancelTransaction(id, staffUserId);
        auditLogService.createAuditLog(
                staffUserId,
                AuditAction.PAYMENT_TRANSACTION_CANCELLED,
                AuditTargetType.PAYMENT_TRANSACTION,
                id,
                AuditMetadata.of("bookingId", response.getBookingId(), "status", response.getStatus()));
        return ApiResponse.<PaymentTransactionResponse>builder()
                .success(true)
                .message("Transaction cancelled successfully")
                .data(response)
                .build();
    }
}
