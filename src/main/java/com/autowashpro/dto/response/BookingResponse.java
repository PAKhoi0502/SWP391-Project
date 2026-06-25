package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class BookingResponse {
    private Long id;
    private Long customerId;
    private Long vehicleId;
    private Long garageId;
    private Long servicePackageId;
    private Long promotionId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String status;
    private String paymentStatus;
    private BigDecimal originalPrice;
    private BigDecimal discountAmount;
    private BigDecimal finalPrice;
    private BigDecimal depositAmount;
    private String depositStatus;
    private Boolean isWalkIn;
    private Integer usedPoints;
    private String note;
    private LocalDateTime createdAt;
    private String guestName;
private String guestPhone;
private String licensePlate;
private Long createdByStaffId;
}