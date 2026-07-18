package com.autowashpro.dto.review;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class ReviewResponse {

    private Long id;
    private Long bookingId;
    private Long customerId;
    private String customerName;
    private Integer rating;
    private String comment;
    private List<String> imageUrls;
    private LocalDateTime createdAt;
    private String servicePackageName;
    private String garageName;
}
