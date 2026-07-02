package com.autowashpro.service;

import com.autowashpro.dto.request.CreatePromotionRequest;
import com.autowashpro.dto.request.PromotionValidateRequest;
import com.autowashpro.dto.request.SendVoucherRequest;
import com.autowashpro.dto.request.UpdatePromotionRequest;
import com.autowashpro.dto.response.PromotionDetailResponse;
import com.autowashpro.dto.response.PromotionResponse;
import com.autowashpro.dto.response.PromotionUsageResponse;
import com.autowashpro.dto.response.PromotionValidateResponse;

import java.util.List;

public interface PromotionService {

        PromotionResponse createPromotion(CreatePromotionRequest request);

        PromotionResponse updatePromotion(Long id, UpdatePromotionRequest request);

        PromotionResponse updatePromotionStatus(Long id, Boolean active);

        List<PromotionResponse> getActivePromotions();

        List<PromotionResponse> getEligiblePromotions(
                        Long customerId,
                        Long servicePackageId,
                        java.math.BigDecimal orderAmount);

        PromotionDetailResponse getPromotion(Long id);

        PromotionValidateResponse validatePromotion(
                        Long customerId,
                        PromotionValidateRequest request);

        void recordPromotionUsageAfterPaidBooking(Long bookingId);

        List<PromotionUsageResponse> getAllPromotionUsages();

        List<PromotionUsageResponse> getPromotionUsages(Long promotionId);

        List<PromotionUsageResponse> getMyPromotionUsages(Long customerId);

        int sendVoucher(Long promotionId, SendVoucherRequest request);
}