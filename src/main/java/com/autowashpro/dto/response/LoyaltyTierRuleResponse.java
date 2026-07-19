package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class LoyaltyTierRuleResponse {

    private Long id;

    private String tier;

    private BigDecimal minTotalSpent;

    private Integer minTotalVisits;

    private Integer minTotalPoints;

    private Integer bookingWindowDays;

    private Integer maxUpcomingBookings;

    private BigDecimal pointMultiplier;

    private Integer priorityLevel;

    private Boolean isActive;

    private String color;
}