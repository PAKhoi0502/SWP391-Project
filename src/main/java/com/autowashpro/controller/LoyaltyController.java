package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.response.LoyaltyOverviewResponse;
import com.autowashpro.dto.response.LoyaltyTierRuleResponse;
import com.autowashpro.service.LoyaltyService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import com.autowashpro.dto.request.CreateLoyaltyTierRuleRequest;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import com.autowashpro.dto.request.UpdateLoyaltyTierRuleRequest;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;

@RestController
@RequestMapping("/loyalty")
@RequiredArgsConstructor
public class LoyaltyController {

    private final LoyaltyService loyaltyService;

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
    @PreAuthorize("hasAnyRole('CUSTOMER','STAFF','ADMIN')")
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

        return ApiResponse.<LoyaltyTierRuleResponse>builder()
                .success(true)
                .message("Tier rule created successfully")
                .data(loyaltyService.createTierRule(request))
                .build();
    }

    @PatchMapping("/admin/tier-rules/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<LoyaltyTierRuleResponse> updateTierRule(
            @PathVariable Long id,
            @RequestBody UpdateLoyaltyTierRuleRequest request) {

        return ApiResponse.<LoyaltyTierRuleResponse>builder()
                .success(true)
                .message("Tier rule updated successfully")
                .data(loyaltyService.updateTierRule(id, request))
                .build();
    }
}