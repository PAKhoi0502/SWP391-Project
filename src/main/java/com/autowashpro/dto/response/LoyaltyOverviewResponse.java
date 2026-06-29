package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

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

}