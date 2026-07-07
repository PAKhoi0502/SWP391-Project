package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.request.AnalyticsFilterRequest;
import com.autowashpro.dto.response.AnalyticsOverviewResponse;
import com.autowashpro.dto.response.BookingAnalyticsResponse;
import com.autowashpro.dto.response.LoyaltyAnalyticsResponse;
import com.autowashpro.dto.response.PromotionAnalyticsResponse;
import com.autowashpro.dto.response.RevenueAnalyticsResponse;
import com.autowashpro.dto.response.WashBayAnalyticsResponse;
import com.autowashpro.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/admin/analytics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/overview")
    public ApiResponse<AnalyticsOverviewResponse> overview(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(name = "garage_id", required = false) Long garageId) {

        return ApiResponse.<AnalyticsOverviewResponse>builder()
                .success(true)
                .message("Analytics overview retrieved successfully")
                .data(analyticsService.getOverview(filter(from, to, garageId)))
                .build();
    }

    @GetMapping("/bookings")
    public ApiResponse<BookingAnalyticsResponse> bookings(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(name = "garage_id", required = false) Long garageId) {

        return ApiResponse.<BookingAnalyticsResponse>builder()
                .success(true)
                .message("Booking analytics retrieved successfully")
                .data(analyticsService.getBookingStatistics(filter(from, to, garageId)))
                .build();
    }

    @GetMapping("/revenue")
    public ApiResponse<RevenueAnalyticsResponse> revenue(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(name = "garage_id", required = false) Long garageId) {

        return ApiResponse.<RevenueAnalyticsResponse>builder()
                .success(true)
                .message("Revenue analytics retrieved successfully")
                .data(analyticsService.getRevenueStatistics(filter(from, to, garageId)))
                .build();
    }

    @GetMapping("/loyalty")
    public ApiResponse<LoyaltyAnalyticsResponse> loyalty(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(name = "garage_id", required = false) Long garageId) {

        return ApiResponse.<LoyaltyAnalyticsResponse>builder()
                .success(true)
                .message("Loyalty analytics retrieved successfully")
                .data(analyticsService.getLoyaltyStatistics(filter(from, to, garageId)))
                .build();
    }

    @GetMapping("/promotions")
    public ApiResponse<PromotionAnalyticsResponse> promotions(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(name = "garage_id", required = false) Long garageId) {

        return ApiResponse.<PromotionAnalyticsResponse>builder()
                .success(true)
                .message("Promotion analytics retrieved successfully")
                .data(analyticsService.getPromotionPerformance(filter(from, to, garageId)))
                .build();
    }

    @GetMapping("/wash-bays")
    public ApiResponse<WashBayAnalyticsResponse> washBays(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(name = "garage_id", required = false) Long garageId) {

        return ApiResponse.<WashBayAnalyticsResponse>builder()
                .success(true)
                .message("Wash bay analytics retrieved successfully")
                .data(analyticsService.getWashBayPerformance(filter(from, to, garageId)))
                .build();
    }

    private AnalyticsFilterRequest filter(LocalDate from, LocalDate to, Long garageId) {
        return AnalyticsFilterRequest.builder()
                .from(from)
                .to(to)
                .garageId(garageId)
                .build();
    }
}
