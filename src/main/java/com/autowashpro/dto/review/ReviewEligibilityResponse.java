package com.autowashpro.dto.review;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ReviewEligibilityResponse {

    private boolean eligible;
    private String reason;
    private boolean alreadyReviewed;
    private ReviewResponse existingReview;
}
