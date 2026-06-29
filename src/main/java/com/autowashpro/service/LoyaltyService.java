package com.autowashpro.service;

import com.autowashpro.dto.request.UpdateLoyaltyTierRuleRequest;
import com.autowashpro.dto.response.LoyaltyOverviewResponse;
import com.autowashpro.dto.response.LoyaltyTierRuleResponse;
import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.dto.request.CreateLoyaltyTierRuleRequest;
import java.util.List;

public interface LoyaltyService {

    CustomerLoyalty getOrCreateCustomerLoyalty(Long customerId);

    LoyaltyOverviewResponse getMyLoyalty(Long customerId);

    List<LoyaltyTierRuleResponse> getTierRules();

    void reviewCustomerTier(Long customerId);

    void updateBookingStatistics(Long bookingId);

    List<LoyaltyTierRuleResponse> getAdminTierRules();

    LoyaltyTierRuleResponse createTierRule(
            CreateLoyaltyTierRuleRequest request);

    LoyaltyTierRuleResponse updateTierRule(
            Long id,
            UpdateLoyaltyTierRuleRequest request);
}