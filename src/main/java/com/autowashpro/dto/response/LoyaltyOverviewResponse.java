package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class LoyaltyOverviewResponse {

    private String currentTier;

    private Integer totalPoints;

    private Integer availablePoints;

    private Integer redeemedPoints;

    private Integer expiredPoints;

    private BigDecimal totalSpent;

    private Integer totalVisits;

    /** Points that will expire at the earliest upcoming expiry date (null if no expiring lots). */
    private Integer nextExpiringPoints;

    /** Earliest upcoming expiry date across all active lots with a set expiry (null if none). */
    private LocalDateTime nextExpiryAt;
}
