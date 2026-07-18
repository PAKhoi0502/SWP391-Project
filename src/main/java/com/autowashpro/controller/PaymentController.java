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
import org.springframework.security.core.Authentication;
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
@PreAuthorize("hasRole('CUSTOMER') or hasRole('STAFF') or hasRole('ADMIN')")
public ApiResponse<CreatePayOSPaymentResponse> createPayOSPayment(
        @Valid @RequestBody CreatePayOSPaymentRequest request,
        @AuthenticationPrincipal UserDetails userDetails,
        Authentication authentication) {

    Long callerId = Long.valueOf(userDetails.getUsername());
    String role = authentication.getAuthorities().stream()
            .findFirst().orElseThrow().getAuthority().replace("ROLE_", "");
    CreatePayOSPaymentResponse response = "CUSTOMER".equalsIgnoreCase(role)
            ? paymentService.createPayOSPaymentForCustomer(request, callerId)
            : paymentService.createPayOSPayment(request, callerId);
    auditLogService.createAuditLog(
            callerId,
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
    @PreAuthorize("hasRole('CUSTOMER') or hasRole('STAFF') or hasRole('ADMIN')")
    public ApiResponse<PaymentTransactionResponse> getTransactionById(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails,
            Authentication authentication) {

        String role = authentication.getAuthorities().stream()
                .findFirst().orElseThrow().getAuthority().replace("ROLE_", "");
        PaymentTransactionResponse data = "CUSTOMER".equalsIgnoreCase(role)
                ? paymentService.getTransactionByIdForCustomer(id, Long.valueOf(userDetails.getUsername()))
                : paymentService.getTransactionById(id);

        return ApiResponse.<PaymentTransactionResponse>builder()
                .success(true)
                .message("Transaction retrieved")
                .data(data)
                .build();
    }

    @GetMapping("/bookings/{bookingId}/payment-transactions")
    @PreAuthorize("hasRole('CUSTOMER') or hasRole('STAFF') or hasRole('ADMIN')")
    public ApiResponse<List<PaymentTransactionResponse>> getTransactionsByBooking(
            @PathVariable Long bookingId,
            @RequestParam(required = false) String purpose,
            @AuthenticationPrincipal UserDetails userDetails,
            Authentication authentication) {

        String role = authentication.getAuthorities().stream()
                .findFirst().orElseThrow().getAuthority().replace("ROLE_", "");
        List<PaymentTransactionResponse> data = "CUSTOMER".equalsIgnoreCase(role)
                ? paymentService.getTransactionsByBookingForCustomer(bookingId, Long.valueOf(userDetails.getUsername()), purpose)
                : paymentService.getTransactionsByBooking(bookingId);

        return ApiResponse.<List<PaymentTransactionResponse>>builder()
                .success(true)
                .message("Transactions retrieved")
                .data(data)
                .build();
    }

    @PatchMapping("/transactions/{id}/cancel")
    @PreAuthorize("hasRole('CUSTOMER') or hasRole('STAFF') or hasRole('ADMIN')")
    public ApiResponse<PaymentTransactionResponse> cancelTransaction(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails,
            Authentication authentication) {

        Long callerId = Long.valueOf(userDetails.getUsername());
        String role = authentication.getAuthorities().stream()
                .findFirst().orElseThrow().getAuthority().replace("ROLE_", "");
        PaymentTransactionResponse response = "CUSTOMER".equalsIgnoreCase(role)
                ? paymentService.cancelTransactionForCustomer(id, callerId)
                : paymentService.cancelTransaction(id, callerId);
        auditLogService.createAuditLog(
                callerId,
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
