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
    private String customerName;
    private Long vehicleId;
    private String vehicleName;
    private Long garageId;
    private String garageName;
    private Long servicePackageId;
    private String servicePackageName;
    private LocalDateTime completedAt;
    private LocalDateTime paidAt;
    private BigDecimal finalPrice;
    private Integer earnedPoints;
    private LocalDateTime createdAt;
}