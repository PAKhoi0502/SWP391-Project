package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.request.BookingExceptionReportCreateRequest;
import com.autowashpro.dto.request.UpdateExceptionReportStatusRequest;
import com.autowashpro.dto.response.BookingExceptionReportResponse;
import com.autowashpro.service.BookingExceptionReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class BookingExceptionReportController {

    private final BookingExceptionReportService bookingExceptionReportService;

    // ── Customer endpoint ─────────────────────────────────────────────────────

    @PostMapping("/bookings/{bookingId}/exception-reports")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<BookingExceptionReportResponse> createReport(
            @PathVariable Long bookingId,
            @Valid @RequestBody BookingExceptionReportCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<BookingExceptionReportResponse>builder()
                .success(true)
                .message("Report submitted successfully")
                .data(bookingExceptionReportService.createReport(bookingId, customerId, request))
                .build();
    }

    @GetMapping("/customer/exception-reports")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<List<BookingExceptionReportResponse>> getMyReports(
            @AuthenticationPrincipal UserDetails userDetails) {

        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<List<BookingExceptionReportResponse>>builder()
                .success(true)
                .message("Reports retrieved")
                .data(bookingExceptionReportService.getMyReports(customerId))
                .build();
    }

    // ── Admin endpoints ───────────────────────────────────────────────────────

    @GetMapping("/admin/exception-reports")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Page<BookingExceptionReportResponse>> getAdminReports(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category) {

        return ApiResponse.<Page<BookingExceptionReportResponse>>builder()
                .success(true)
                .message("Reports retrieved")
                .data(bookingExceptionReportService.getAdminReports(page, limit, status, category))
                .build();
    }

    @GetMapping("/admin/exception-reports/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<BookingExceptionReportResponse> getAdminReportDetail(@PathVariable Long id) {

        return ApiResponse.<BookingExceptionReportResponse>builder()
                .success(true)
                .message("Report detail retrieved")
                .data(bookingExceptionReportService.getAdminReportDetail(id))
                .build();
    }

    @PatchMapping("/admin/exception-reports/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<BookingExceptionReportResponse> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateExceptionReportStatusRequest request) {

        return ApiResponse.<BookingExceptionReportResponse>builder()
                .success(true)
                .message("Report status updated")
                .data(bookingExceptionReportService.updateStatus(id, request))
                .build();
    }
}
