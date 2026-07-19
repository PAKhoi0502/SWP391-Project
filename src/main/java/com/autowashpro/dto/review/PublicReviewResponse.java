package com.autowashpro.dto.review;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Public-safe review DTO — excludes all PII (no customerId, bookingId, customerName).
 * displayName is already masked ("Hoàng T.", "Alice", …).
 */
@Data
@Builder
public class PublicReviewResponse {

    private Long id;

    /** Masked display name, e.g. "Hoàng T." */
    private String displayName;

    /** 1–2 char initials for avatar fallback, e.g. "HT" */
    private String initials;

    /** Presigned URL from uploads system; null when customer has no avatar. */
    private String avatarUrl;

    /** All-time leaderboard rank; null when customer has no earned points. */
    private Integer leaderboardRank;

    private Integer rating;
    private String comment;
    private List<String> imageUrls;
    private LocalDateTime createdAt;
    private String servicePackageName;
    private String garageName;
}
