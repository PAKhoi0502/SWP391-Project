package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class CustomerExpiryResultResponse {
    private Long customerId;
    private LocalDateTime checkedAt;
    private int availablePointsBefore;
    private int availablePointsAfter;
    private int expiredPointsBefore;
    private int expiredPointsAfter;
    private int lotsExpired;
    private int pointsExpired;
    private Integer nextExpiringPoints;
    private LocalDateTime nextExpiryAt;
    private LocalDateTime lastExpiryCheckAt;
    private boolean changed;
    private String message;
}
