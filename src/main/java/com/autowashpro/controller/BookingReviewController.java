package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.review.AdminReviewStatsResponse;
import com.autowashpro.dto.review.ReviewCreateRequest;
import com.autowashpro.dto.review.ReviewEligibilityResponse;
import com.autowashpro.dto.review.ReviewResponse;
import com.autowashpro.service.BookingReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class BookingReviewController {

    private final BookingReviewService bookingReviewService;

    // ── Customer endpoints ────────────────────────────────────────────────────

    @GetMapping("/bookings/{bookingId}/review-eligibility")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<ReviewEligibilityResponse> checkEligibility(
            @PathVariable Long bookingId,
            @AuthenticationPrincipal UserDetails userDetails) {

        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<ReviewEligibilityResponse>builder()
                .success(true)
                .message("Eligibility check completed")
                .data(bookingReviewService.checkEligibility(bookingId, customerId))
                .build();
    }

    @PostMapping("/bookings/{bookingId}/reviews")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<ReviewResponse> createReview(
            @PathVariable Long bookingId,
            @Valid @RequestBody ReviewCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<ReviewResponse>builder()
                .success(true)
                .message("Review submitted successfully")
                .data(bookingReviewService.createReview(bookingId, customerId, request))
                .build();
    }

    @GetMapping("/bookings/{bookingId}/reviews")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<ReviewResponse> getMyReview(
            @PathVariable Long bookingId,
            @AuthenticationPrincipal UserDetails userDetails) {

        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<ReviewResponse>builder()
                .success(true)
                .message("Review retrieved")
                .data(bookingReviewService.getMyReview(bookingId, customerId))
                .build();
    }

    // ── Public endpoints (no auth) ────────────────────────────────────────────

    @GetMapping("/public/reviews")
    public ApiResponse<Page<ReviewResponse>> getPublicReviews(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {

        return ApiResponse.<Page<ReviewResponse>>builder()
                .success(true)
                .message("Reviews retrieved")
                .data(bookingReviewService.getPublicReviews(page, limit))
                .build();
    }

    @GetMapping("/public/reviews/stats")
    public ApiResponse<AdminReviewStatsResponse> getPublicStats() {

        return ApiResponse.<AdminReviewStatsResponse>builder()
                .success(true)
                .message("Stats retrieved")
                .data(bookingReviewService.getPublicStats())
                .build();
    }

    // ── Admin endpoints ───────────────────────────────────────────────────────

    @GetMapping("/admin/reviews")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Page<ReviewResponse>> getAdminReviews(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit) {

        return ApiResponse.<Page<ReviewResponse>>builder()
                .success(true)
                .message("Reviews retrieved")
                .data(bookingReviewService.getAdminReviews(page, limit))
                .build();
    }

    @GetMapping("/admin/reviews/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<AdminReviewStatsResponse> getAdminStats() {

        return ApiResponse.<AdminReviewStatsResponse>builder()
                .success(true)
                .message("Stats retrieved")
                .data(bookingReviewService.getAdminStats())
                .build();
    }
}
