package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.request.CreateDepositRefundRequest;
import com.autowashpro.dto.response.DepositRefundEligibilityResponse;
import com.autowashpro.dto.response.DepositRefundResponse;
import com.autowashpro.service.DepositRefundService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class DepositRefundController {

    private final DepositRefundService depositRefundService;

    @GetMapping("/bookings/{bookingId}/refund-eligibility")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<DepositRefundEligibilityResponse> getRefundEligibility(
            @PathVariable Long bookingId,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<DepositRefundEligibilityResponse>builder()
                .success(true)
                .message("Refund eligibility retrieved successfully")
                .data(depositRefundService.getEligibility(bookingId, customerId))
                .build();
    }

    @PostMapping("/bookings/{bookingId}/deposit-refunds")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<DepositRefundResponse> createDepositRefund(
            @PathVariable Long bookingId,
            @Valid @RequestBody CreateDepositRefundRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<DepositRefundResponse>builder()
                .success(true)
                .message("Deposit refund requested successfully")
                .data(depositRefundService.createRequest(bookingId, customerId, request))
                .build();
    }

    @GetMapping("/me/deposit-refunds")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<List<DepositRefundResponse>> listMyDepositRefunds(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<List<DepositRefundResponse>>builder()
                .success(true)
                .message("Deposit refunds retrieved successfully")
                .data(depositRefundService.listOwn(customerId))
                .build();
    }

    @GetMapping("/me/deposit-refunds/{refundId}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<DepositRefundResponse> getMyDepositRefund(
            @PathVariable Long refundId,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<DepositRefundResponse>builder()
                .success(true)
                .message("Deposit refund retrieved successfully")
                .data(depositRefundService.getOwnById(refundId, customerId))
                .build();
    }
}
