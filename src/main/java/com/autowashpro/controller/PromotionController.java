package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.request.CreatePromotionRequest;
import com.autowashpro.dto.request.PromotionValidateRequest;
import com.autowashpro.dto.request.SendVoucherRequest;
import com.autowashpro.dto.request.UpdatePromotionRequest;
import com.autowashpro.dto.response.PromotionDetailResponse;
import com.autowashpro.dto.response.PromotionResponse;
import com.autowashpro.dto.response.PromotionUsageResponse;
import com.autowashpro.dto.response.PromotionValidateResponse;
import com.autowashpro.service.PromotionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/promotions")
@RequiredArgsConstructor
public class PromotionController {

    private final PromotionService promotionService;

    @PostMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PromotionResponse> createPromotion(
            @RequestBody CreatePromotionRequest request) {

        return ApiResponse.<PromotionResponse>builder()
                .success(true)
                .message("Promotion created successfully")
                .data(promotionService.createPromotion(request))
                .build();
    }

    @PatchMapping("/admin/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PromotionResponse> updatePromotion(
            @PathVariable Long id,
            @RequestBody UpdatePromotionRequest request) {

        return ApiResponse.<PromotionResponse>builder()
                .success(true)
                .message("Promotion updated successfully")
                .data(promotionService.updatePromotion(id, request))
                .build();
    }

    @PatchMapping("/admin/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PromotionResponse> updateStatus(
            @PathVariable Long id,
            @RequestParam Boolean active) {

        return ApiResponse.<PromotionResponse>builder()
                .success(true)
                .message("Promotion status updated successfully")
                .data(promotionService.updatePromotionStatus(id, active))
                .build();
    }

    @GetMapping
    public ApiResponse<List<PromotionResponse>> getPromotions() {

        return ApiResponse.<List<PromotionResponse>>builder()
                .success(true)
                .message("Promotions retrieved successfully")
                .data(promotionService.getActivePromotions())
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<PromotionDetailResponse> getPromotion(
            @PathVariable Long id) {

        return ApiResponse.<PromotionDetailResponse>builder()
                .success(true)
                .message("Promotion retrieved successfully")
                .data(promotionService.getPromotion(id))
                .build();
    }

    @PostMapping("/validate")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<PromotionValidateResponse> validatePromotion(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody PromotionValidateRequest request) {

        Long customerId = Long.valueOf(userDetails.getUsername());

        return ApiResponse.<PromotionValidateResponse>builder()
                .success(true)
                .message("Promotion validated successfully")
                .data(promotionService.validatePromotion(customerId, request))
                .build();
    }

    @GetMapping("/eligible")
    @PreAuthorize("hasRole(" + "'CUSTOMER'" + ")")
    public ApiResponse<List<PromotionResponse>> getEligiblePromotions(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam Long servicePackageId,
            @RequestParam BigDecimal orderAmount) {

        Long customerId = Long.valueOf(userDetails.getUsername());

        return ApiResponse.<List<PromotionResponse>>builder()
                .success(true)
                .message("Eligible promotions retrieved successfully")
                .data(
                        promotionService.getEligiblePromotions(
                                customerId,
                                servicePackageId,
                                orderAmount))
                .build();
    }
    @GetMapping("/admin/promotion-usages")
@PreAuthorize("hasRole('ADMIN')")
public ApiResponse<List<PromotionUsageResponse>> getAllPromotionUsages() {

    return ApiResponse.<List<PromotionUsageResponse>>builder()
            .success(true)
            .message("Promotion usages retrieved successfully")
            .data(promotionService.getAllPromotionUsages())
            .build();
}

@GetMapping("/admin/promotions/{promotionId}/usages")
@PreAuthorize("hasRole('ADMIN')")
public ApiResponse<List<PromotionUsageResponse>> getPromotionUsages(
        @PathVariable Long promotionId) {

    return ApiResponse.<List<PromotionUsageResponse>>builder()
            .success(true)
            .message("Promotion usages retrieved successfully")
            .data(promotionService.getPromotionUsages(promotionId))
            .build();
}

@GetMapping("/promotions/me/usages")
@PreAuthorize("hasRole('CUSTOMER')")
public ApiResponse<List<PromotionUsageResponse>> getMyPromotionUsages(
        @AuthenticationPrincipal UserDetails userDetails) {

    Long customerId = Long.valueOf(userDetails.getUsername());

    return ApiResponse.<List<PromotionUsageResponse>>builder()
            .success(true)
            .message("Promotion usages retrieved successfully")
            .data(promotionService.getMyPromotionUsages(customerId))
            .build();
}
@PostMapping("/{id}/send-voucher")
@PreAuthorize("hasRole('ADMIN')")
public ApiResponse<Integer> sendVoucher(
        @PathVariable Long id,
        @RequestBody SendVoucherRequest request) {
    int count = promotionService.sendVoucher(id, request);
    return ApiResponse.<Integer>builder()
            .success(true)
            .message("Voucher sent to " + count + " customers")
            .data(count)
            .build();
}
}