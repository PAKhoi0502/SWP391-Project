package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.common.AuditAction;
import com.autowashpro.common.AuditActorContext;
import com.autowashpro.common.AuditMetadata;
import com.autowashpro.common.AuditTargetType;
import com.autowashpro.dto.request.AdjustPointsRequest;
import com.autowashpro.dto.request.CreateLoyaltyTierRuleRequest;
import com.autowashpro.dto.request.RedeemPreviewRequest;
import com.autowashpro.dto.request.UpdateLoyaltyTierRuleRequest;
import com.autowashpro.dto.response.LoyaltyOverviewResponse;
import com.autowashpro.dto.response.LoyaltyTierRuleResponse;
import com.autowashpro.dto.response.PointTransactionResponse;
import com.autowashpro.dto.response.RedeemPreviewResponse;
import com.autowashpro.service.LoyaltyService;
import com.autowashpro.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/loyalty")
@RequiredArgsConstructor
public class LoyaltyController {

    private final LoyaltyService loyaltyService;
    private final AuditLogService auditLogService;

    @GetMapping("/me")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<LoyaltyOverviewResponse> getMyLoyalty(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<LoyaltyOverviewResponse>builder()
                .success(true)
                .message("Loyalty overview retrieved successfully")
                .data(loyaltyService.getMyLoyalty(customerId))
                .build();
    }

    @GetMapping("/tier-rules")
    public ApiResponse<List<LoyaltyTierRuleResponse>> getTierRules() {
        return ApiResponse.<List<LoyaltyTierRuleResponse>>builder()
                .success(true)
                .message("Tier rules retrieved successfully")
                .data(loyaltyService.getTierRules())
                .build();
    }

    @GetMapping("/admin/tier-rules")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<LoyaltyTierRuleResponse>> getAdminTierRules() {
        return ApiResponse.<List<LoyaltyTierRuleResponse>>builder()
                .success(true)
                .message("Admin tier rules retrieved successfully")
                .data(loyaltyService.getAdminTierRules())
                .build();
    }

    @PostMapping("/admin/tier-rules")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<LoyaltyTierRuleResponse> createTierRule(
            @RequestBody CreateLoyaltyTierRuleRequest request) {
        LoyaltyTierRuleResponse response = loyaltyService.createTierRule(request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.LOYALTY_TIER_RULE_CREATED,
                AuditTargetType.LOYALTY_TIER_RULE,
                response.getId(),
                AuditMetadata.of("tier", response.getTier()));
        return ApiResponse.<LoyaltyTierRuleResponse>builder()
                .success(true)
                .message("Tier rule created successfully")
                .data(response)
                .build();
    }

    @PatchMapping("/admin/tier-rules/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<LoyaltyTierRuleResponse> updateTierRule(
            @PathVariable Long id,
            @RequestBody UpdateLoyaltyTierRuleRequest request) {
        LoyaltyTierRuleResponse response = loyaltyService.updateTierRule(id, request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.LOYALTY_TIER_RULE_UPDATED,
                AuditTargetType.LOYALTY_TIER_RULE,
                id,
                AuditMetadata.of("tier", response.getTier()));
        return ApiResponse.<LoyaltyTierRuleResponse>builder()
                .success(true)
                .message("Tier rule updated successfully")
                .data(response)
                .build();
    }

    // ===================== ISSUE #23 =====================

    @GetMapping("/me/transactions")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<Page<PointTransactionResponse>> getMyTransactions(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<Page<PointTransactionResponse>>builder()
                .success(true)
                .message("Transactions retrieved successfully")
                .data(loyaltyService.getMyTransactions(customerId, page, limit, type))
                .build();
    }

    @PostMapping("/redeem-preview")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<RedeemPreviewResponse> redeemPreview(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody RedeemPreviewRequest request) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<RedeemPreviewResponse>builder()
                .success(true)
                .message("Redeem preview calculated successfully")
                .data(loyaltyService.redeemPreview(customerId, request))
                .build();
    }

    @PostMapping("/admin/adjust-points")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> adjustPoints(
            @RequestBody AdjustPointsRequest request) {
        loyaltyService.adjustPoints(
                request.getCustomerId(),
                request.getPoints(),
                request.getType(),
                request.getReason());
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.LOYALTY_POINTS_ADJUSTED,
                AuditTargetType.CUSTOMER_LOYALTY,
                request.getCustomerId(),
                AuditMetadata.of(
                        "points", request.getPoints(),
                        "type", request.getType(),
                        "reason", request.getReason()));
        return ApiResponse.<Void>builder()
                .success(true)
                .message("Points adjusted successfully")
                .build();
    }
}
