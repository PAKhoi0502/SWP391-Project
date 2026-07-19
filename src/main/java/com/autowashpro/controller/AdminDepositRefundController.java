package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.request.ExecuteDepositRefundRequest;
import com.autowashpro.dto.request.RejectDepositRefundRequest;
import com.autowashpro.dto.response.DepositRefundResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.service.DepositRefundService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/deposit-refunds")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminDepositRefundController {

    private final DepositRefundService depositRefundService;

    @GetMapping
    public ApiResponse<PageResponse<DepositRefundResponse>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String status) {
        return ApiResponse.<PageResponse<DepositRefundResponse>>builder()
                .success(true)
                .message("Deposit refunds retrieved successfully")
                .data(depositRefundService.listForAdmin(page, limit, status))
                .build();
    }

    @GetMapping("/{refundId}")
    public ApiResponse<DepositRefundResponse> getById(@PathVariable Long refundId) {
        return ApiResponse.<DepositRefundResponse>builder()
                .success(true)
                .message("Deposit refund retrieved successfully")
                .data(depositRefundService.getByIdForAdmin(refundId))
                .build();
    }

    @PatchMapping("/{refundId}/approve")
    public ApiResponse<DepositRefundResponse> approve(
            @PathVariable Long refundId,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long adminId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<DepositRefundResponse>builder()
                .success(true)
                .message("Deposit refund approved successfully")
                .data(depositRefundService.approve(refundId, adminId))
                .build();
    }

    @PatchMapping("/{refundId}/reject")
    public ApiResponse<DepositRefundResponse> reject(
            @PathVariable Long refundId,
            @Valid @RequestBody RejectDepositRefundRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long adminId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<DepositRefundResponse>builder()
                .success(true)
                .message("Deposit refund rejected successfully")
                .data(depositRefundService.reject(refundId, adminId, request))
                .build();
    }

    @PostMapping("/{refundId}/execute")
    public ApiResponse<DepositRefundResponse> execute(
            @PathVariable Long refundId,
            @Valid @RequestBody(required = false) ExecuteDepositRefundRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long adminId = Long.valueOf(userDetails.getUsername());
        ExecuteDepositRefundRequest body = request != null ? request : new ExecuteDepositRefundRequest();
        return ApiResponse.<DepositRefundResponse>builder()
                .success(true)
                .message("Deposit refund executed successfully")
                .data(depositRefundService.execute(refundId, adminId, body))
                .build();
    }
}
