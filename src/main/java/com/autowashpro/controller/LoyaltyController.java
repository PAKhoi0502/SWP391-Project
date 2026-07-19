package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.common.AuditAction;
import com.autowashpro.common.AuditActorContext;
import com.autowashpro.common.AuditMetadata;
import com.autowashpro.common.AuditTargetType;
import com.autowashpro.dto.request.AdjustPointsRequest;
import com.autowashpro.dto.request.CreateLoyaltyTierRuleRequest;
import com.autowashpro.dto.request.ExtendLotExpiryRequest;
import com.autowashpro.dto.request.RedeemPreviewRequest;
import com.autowashpro.dto.request.UpdateLoyaltyTierRuleRequest;
import com.autowashpro.dto.response.CreditLotResponse;
import com.autowashpro.dto.response.CustomerExpiryResultResponse;
import com.autowashpro.dto.response.ExpiryRunResult;
import com.autowashpro.dto.response.LeaderboardResponse;
import com.autowashpro.dto.response.LoyaltyOverviewResponse;
import com.autowashpro.dto.response.LoyaltyTierRuleResponse;
import com.autowashpro.dto.response.PointTransactionResponse;
import com.autowashpro.dto.response.RedeemPreviewResponse;
import com.autowashpro.entity.ExpiryRunLog;
import com.autowashpro.repository.ExpiryRunLogRepository;
import com.autowashpro.scheduler.LoyaltyPointExpiryScheduler;
import com.autowashpro.service.AuditLogService;
import com.autowashpro.service.LoyaltyPointExpiryService;
import com.autowashpro.service.LoyaltyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/loyalty")
@RequiredArgsConstructor
public class LoyaltyController {

    private final LoyaltyService loyaltyService;
    private final LoyaltyPointExpiryService loyaltyPointExpiryService;
    private final AuditLogService auditLogService;
    private final LoyaltyPointExpiryScheduler loyaltyPointExpiryScheduler;
    private final ExpiryRunLogRepository expiryRunLogRepository;

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

    @GetMapping("/leaderboard")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<LeaderboardResponse> getLeaderboard(
            @RequestParam(defaultValue = "MONTHLY") String period,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long currentCustomerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<LeaderboardResponse>builder()
                .success(true)
                .message("Leaderboard retrieved")
                .data(loyaltyService.getLeaderboard(period, page, limit, currentCustomerId))
                .build();
    }

    @PostMapping("/admin/adjust-points")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> adjustPoints(
            @Valid @RequestBody AdjustPointsRequest request) {
        if (request.getPoints() == null || request.getPoints() == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Points must be non-zero");
        }
        loyaltyService.adjustPoints(
                request.getCustomerId(),
                request.getPoints(),
                request.getType(),
                request.getReason().trim());
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

    // ── Admin: Customer overview ──────────────────────────────────────────────

    @GetMapping("/admin/customers/{customerId}/overview")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<LoyaltyOverviewResponse> getAdminCustomerOverview(
            @PathVariable Long customerId) {
        return ApiResponse.<LoyaltyOverviewResponse>builder()
                .success(true)
                .message("Customer loyalty overview retrieved successfully")
                .data(loyaltyService.getMyLoyalty(customerId))
                .build();
    }

    // ── Admin: Credit Lots & Expiry Management ────────────────────────────────

    @GetMapping("/admin/customers/{customerId}/credit-lots")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Page<CreditLotResponse>> getCustomerCreditLots(
            @PathVariable Long customerId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer expiringWithinDays,
            @RequestParam(required = false) String type) {
        return ApiResponse.<Page<CreditLotResponse>>builder()
                .success(true)
                .message("Credit lots retrieved successfully")
                .data(loyaltyPointExpiryService.getCreditLots(
                        customerId, page, limit, status, expiringWithinDays, type))
                .build();
    }

    @GetMapping("/admin/customers/{customerId}/transactions")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Page<PointTransactionResponse>> getCustomerTransactions(
            @PathVariable Long customerId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.<Page<PointTransactionResponse>>builder()
                .success(true)
                .message("Transactions retrieved successfully")
                .data(loyaltyService.getMyTransactions(customerId, page, limit, type))
                .build();
    }

    @PatchMapping("/admin/credit-lots/{lotId}/expiry")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> extendLotExpiry(
            @PathVariable Long lotId,
            @Valid @RequestBody ExtendLotExpiryRequest request) {
        loyaltyPointExpiryService.extendLotExpiry(
                lotId, request.getNewExpiredAt(), request.getReason().trim());
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.LOYALTY_LOT_EXPIRY_EXTENDED,
                AuditTargetType.POINT_TRANSACTION,
                lotId,
                AuditMetadata.of(
                        "newExpiredAt", request.getNewExpiredAt(),
                        "reason", request.getReason()));
        return ApiResponse.<Void>builder()
                .success(true)
                .message("Lot expiry extended successfully")
                .build();
    }

    @PostMapping("/admin/customers/{customerId}/run-expiry")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<CustomerExpiryResultResponse> runExpiryForCustomer(
            @PathVariable Long customerId) {
        CustomerExpiryResultResponse result = loyaltyPointExpiryService.expireForCustomerAdmin(customerId);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.LOYALTY_EXPIRY_RUN_MANUAL,
                AuditTargetType.CUSTOMER_LOYALTY,
                customerId,
                AuditMetadata.of(
                        "trigger", "MANUAL_ADMIN",
                        "checkedAt", result.getCheckedAt(),
                        "lotsExpired", result.getLotsExpired(),
                        "pointsExpired", result.getPointsExpired(),
                        "availablePointsBefore", result.getAvailablePointsBefore(),
                        "availablePointsAfter", result.getAvailablePointsAfter()));
        return ApiResponse.<CustomerExpiryResultResponse>builder()
                .success(true)
                .message(result.isChanged()
                        ? "Expiry completed: " + result.getPointsExpired() + " points expired"
                        : "No expired points found for customer " + customerId)
                .data(result)
                .build();
    }

    // ── Admin: Expiry Run History ─────────────────────────────────────────────

    @GetMapping("/admin/expiry-runs/latest")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<ExpiryRunResult> getLatestExpiryRun() {
        Optional<ExpiryRunLog> latestLog =
                expiryRunLogRepository.findTopByTriggerTypeOrderByStartedAtDesc("SCHEDULED");
        ExpiryRunResult result = LoyaltyPointExpiryScheduler.toDto(latestLog.orElse(null));
        return ApiResponse.<ExpiryRunResult>builder()
                .success(true)
                .message(result == null ? "No scheduled expiry run recorded yet" : "Latest scheduled run retrieved")
                .data(result)
                .build();
    }

    @GetMapping("/admin/expiry-runs")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Page<ExpiryRunResult>> getExpiryRunHistory(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String triggerType) {

        int safePage  = Math.max(1, page);
        int safeLimit = Math.max(1, Math.min(100, limit));
        PageRequest pr = PageRequest.of(safePage - 1, safeLimit);

        Page<ExpiryRunLog> logs = (triggerType != null && !triggerType.isBlank())
                ? expiryRunLogRepository.findByTriggerTypeOrderByStartedAtDesc(triggerType.toUpperCase(), pr)
                : expiryRunLogRepository.findAllByOrderByStartedAtDesc(pr);

        Page<ExpiryRunResult> results = logs.map(LoyaltyPointExpiryScheduler::toDto);
        return ApiResponse.<Page<ExpiryRunResult>>builder()
                .success(true)
                .message("Expiry run history retrieved")
                .data(results)
                .build();
    }
}
