package com.autowashpro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalyticsOverviewResponse {
    private LocalDate from;
    private LocalDate to;
    private Long garageId;
    private Long totalBookings;
    private Long completedBookings;
    private Long canceledBookings;
    private Long noShowBookings;
    private Long paidBookings;
    private BigDecimal totalRevenue;
    private Long loyaltyMembers;
    private Integer totalAvailablePoints;
    private Integer totalRedeemedPoints;
    private Long promotionUsages;
    private BigDecimal promotionDiscountAmount;
    private Long washBayUsages;
    private Long washBayUsageMinutes;
}
