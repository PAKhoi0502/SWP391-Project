package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.response.WashHistoryResponse;
import com.autowashpro.service.WashHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class WashHistoryController {

    private final WashHistoryService washHistoryService;

    @GetMapping("/wash-histories")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<Page<WashHistoryResponse>> getMyWashHistories(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<Page<WashHistoryResponse>>builder()
                .success(true)
                .message("Wash histories retrieved successfully")
                .data(washHistoryService.getMyWashHistories(customerId, page, limit))
                .build();
    }

    @GetMapping("/wash-histories/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<WashHistoryResponse> getMyWashHistoryDetail(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<WashHistoryResponse>builder()
                .success(true)
                .message("Wash history retrieved successfully")
                .data(washHistoryService.getMyWashHistoryDetail(id, customerId))
                .build();
    }

    @GetMapping("/admin/wash-histories")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Page<WashHistoryResponse>> getAdminWashHistories(
            @RequestParam(required = false) Long garageId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) String customerName,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {
        return ApiResponse.<Page<WashHistoryResponse>>builder()
                .success(true)
                .message("Wash histories retrieved successfully")
                .data(washHistoryService.getAdminWashHistories(garageId, customerId, customerName, page, limit))
                .build();
    }
}