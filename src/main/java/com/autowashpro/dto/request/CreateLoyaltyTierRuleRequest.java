package com.autowashpro.dto.request;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class CreateLoyaltyTierRuleRequest {

    private String tier;

    private BigDecimal minTotalSpent;

    private Integer minTotalVisits;

    private Integer minTotalPoints;

    private Integer bookingWindowDays;

    private Integer maxUpcomingBookings;

    private BigDecimal pointMultiplier;

    private Integer priorityLevel;

    private String color;
}