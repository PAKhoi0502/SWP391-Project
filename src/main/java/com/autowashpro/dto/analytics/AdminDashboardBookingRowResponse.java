package com.autowashpro.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminDashboardBookingRowResponse {
    private Long bookingId;
    private Long customerId;
    private String customerName;
    private boolean isWalkIn;
    private Long garageId;
    private String garageName;
    private Long servicePackageId;
    private String servicePackageName;
    private LocalDateTime startTime;
    private String paymentStatus;
    private String paymentMethod;
    private BigDecimal finalPrice;
    private String status;
}
