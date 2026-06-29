package com.autowashpro.service;

import com.autowashpro.dto.request.UpdateLoyaltyTierRuleRequest;
import com.autowashpro.dto.response.LoyaltyOverviewResponse;
import com.autowashpro.dto.response.LoyaltyTierRuleResponse;
import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.dto.request.CreateLoyaltyTierRuleRequest;
import com.autowashpro.dto.request.RedeemPreviewRequest;
import com.autowashpro.dto.response.PointTransactionResponse;
import com.autowashpro.dto.response.RedeemPreviewResponse;
import org.springframework.data.domain.Page;
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

// ===================== ISSUE #23 =====================
void earnPointsAfterPaidBooking(Long bookingId);

void refundPointsForCanceledBooking(Long bookingId);

void adjustPoints(Long customerId, Integer points, String type, String reason);

Page<PointTransactionResponse> getMyTransactions(Long customerId, int page, int limit, String type);

RedeemPreviewResponse redeemPreview(Long customerId, RedeemPreviewRequest request);
}