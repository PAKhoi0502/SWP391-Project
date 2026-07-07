package com.autowashpro.service;

import com.autowashpro.dto.request.AnalyticsFilterRequest;
import com.autowashpro.dto.response.AnalyticsOverviewResponse;
import com.autowashpro.dto.response.BookingAnalyticsResponse;
import com.autowashpro.dto.response.LoyaltyAnalyticsResponse;
import com.autowashpro.dto.response.PromotionAnalyticsResponse;
import com.autowashpro.dto.response.RevenueAnalyticsResponse;
import com.autowashpro.dto.response.WashBayAnalyticsResponse;

public interface AnalyticsService {
    AnalyticsOverviewResponse getOverview(AnalyticsFilterRequest filter);

    BookingAnalyticsResponse getBookingStatistics(AnalyticsFilterRequest filter);

    RevenueAnalyticsResponse getRevenueStatistics(AnalyticsFilterRequest filter);

    LoyaltyAnalyticsResponse getLoyaltyStatistics(AnalyticsFilterRequest filter);

    PromotionAnalyticsResponse getPromotionPerformance(AnalyticsFilterRequest filter);

    WashBayAnalyticsResponse getWashBayPerformance(AnalyticsFilterRequest filter);
}
