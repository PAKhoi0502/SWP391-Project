package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class BookingSummaryResponse {

    private Long id;

    private Long customerId;

    private Long garageId;

    private Long vehicleId;

    private Long servicePackageId;

    private List<Long> addOnServicePackageIds;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private String status;

    private String paymentStatus;

    private BigDecimal finalPrice;

    private Boolean isWalkIn;

    private String guestName;

    private String guestPhone;

    private String licensePlate;

    private String vehicleName;

    private Boolean rewardProcessed;

    private Integer pointsEarned;
}
