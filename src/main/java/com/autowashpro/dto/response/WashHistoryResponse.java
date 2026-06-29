package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class WashHistoryResponse {
    private Long id;
    private Long bookingId;
    private Long customerId;
    private Long vehicleId;
    private Long garageId;
    private Long servicePackageId;
    private LocalDateTime completedAt;
    private LocalDateTime paidAt;
    private BigDecimal finalPrice;
    private Integer earnedPoints;
    private LocalDateTime createdAt;
}