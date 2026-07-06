package com.autowashpro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PromotionAnalyticsResponse {
    private LocalDate from;
    private LocalDate to;
    private Long garageId;
    private Long totalUsages;
    private BigDecimal totalDiscountAmount;
    private List<PromotionPerformance> promotions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PromotionPerformance {
        private Long promotionId;
        private String code;
        private String name;
        private Long usageCount;
        private BigDecimal discountAmount;
    }
}
