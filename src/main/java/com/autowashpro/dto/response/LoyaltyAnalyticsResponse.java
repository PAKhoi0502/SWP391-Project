package com.autowashpro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoyaltyAnalyticsResponse {
    private LocalDate from;
    private LocalDate to;
    private Long garageId;
    private Long totalMembers;
    private Integer totalAvailablePoints;
    private Integer totalRedeemedPoints;
    private Integer totalExpiredPoints;
    private BigDecimal totalSpent;
    private Integer totalVisits;
    private Map<String, PointTransactionSummary> pointTransactionsByType;
    private List<TierSummary> byTier;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TierSummary {
        private String tier;
        private Long memberCount;
        private Integer availablePoints;
        private Integer redeemedPoints;
        private BigDecimal totalSpent;
        private Integer totalVisits;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PointTransactionSummary {
        private Long transactionCount;
        private Integer points;
    }
}
