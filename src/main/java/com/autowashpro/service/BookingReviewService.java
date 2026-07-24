package com.autowashpro.service;

import com.autowashpro.dto.review.AdminReviewStatsResponse;
import com.autowashpro.dto.review.PublicReviewResponse;
import com.autowashpro.dto.review.ReviewCreateRequest;
import com.autowashpro.dto.review.ReviewEligibilityResponse;
import com.autowashpro.dto.review.ReviewResponse;
import org.springframework.data.domain.Page;
import java.util.List;

public interface BookingReviewService {

    ReviewEligibilityResponse checkEligibility(Long bookingId, Long customerId);

    ReviewResponse createReview(Long bookingId, Long customerId, ReviewCreateRequest request);

    ReviewResponse getMyReview(Long bookingId, Long customerId);

    Page<ReviewResponse> getAdminReviews(int page, int limit);

    AdminReviewStatsResponse getAdminStats();

    void maybeCreateReviewRequestNotification(Long bookingId);

    /** Returns booking IDs that the given customer has already reviewed. */
    List<Long> getMyReviewedBookingIds(Long customerId);

    Page<PublicReviewResponse> getPublicReviews(int page, int limit);

    AdminReviewStatsResponse getPublicStats();
}
