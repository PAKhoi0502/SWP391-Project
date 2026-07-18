package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.analytics.AdminDashboardBookingRowResponse;
import com.autowashpro.dto.analytics.BookingCalendarDayResponse;
import com.autowashpro.dto.request.AnalyticsFilterRequest;
import com.autowashpro.dto.response.AnalyticsOverviewResponse;
import com.autowashpro.dto.response.BookingAnalyticsResponse;
import com.autowashpro.dto.response.LoyaltyAnalyticsResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.dto.response.PromotionAnalyticsResponse;
import com.autowashpro.dto.response.RevenueAnalyticsResponse;
import com.autowashpro.dto.response.WashBayAnalyticsResponse;
import com.autowashpro.service.AdminDashboardBookingService;
import com.autowashpro.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/admin/analytics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final AdminDashboardBookingService adminDashboardBookingService;

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

    @GetMapping("/booking-management")
    public ApiResponse<PageResponse<AdminDashboardBookingRowResponse>> getBookingManagement(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "6") int limit,
            @RequestParam(defaultValue = "ALL") String tab,
            @RequestParam(required = false) Long garageId,
            @RequestParam(name = "service_package_id", required = false) Long servicePackageId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String date) {

        if (page < 1) page = 1;
        if (limit < 1 || limit > 50) limit = 6;
        return ApiResponse.<PageResponse<AdminDashboardBookingRowResponse>>builder()
                .success(true)
                .message("Booking management data retrieved successfully")
                .data(adminDashboardBookingService.getBookingManagement(
                        page, limit, tab, garageId, servicePackageId, status, date))
                .build();
    }

    @GetMapping("/booking-calendar")
    public ApiResponse<List<BookingCalendarDayResponse>> getBookingCalendar(
            @RequestParam int year,
            @RequestParam int month,
            @RequestParam(required = false) Long garageId,
            @RequestParam(name = "service_package_id", required = false) Long servicePackageId) {
        return ApiResponse.<List<BookingCalendarDayResponse>>builder()
                .success(true)
                .message("Booking calendar retrieved")
                .data(adminDashboardBookingService.getBookingCalendar(year, month, garageId, servicePackageId))
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
