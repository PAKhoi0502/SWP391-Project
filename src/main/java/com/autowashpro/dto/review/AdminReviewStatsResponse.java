package com.autowashpro.dto.review;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class AdminReviewStatsResponse {

    private double averageRating;
    private long totalReviews;
    private Map<Integer, Long> ratingDistribution;
}
