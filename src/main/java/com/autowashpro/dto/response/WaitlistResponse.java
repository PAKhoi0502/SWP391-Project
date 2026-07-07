package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class WaitlistResponse {
    private Long id;
    private Long garageId;
    private String garageName;
    private Long customerId;
    private String customerName;
    private Long vehicleId;
    private String vehicleName;
    private Long servicePackageId;
    private String servicePackageName;
    private Long offeredBookingId;
    private LocalDateTime desiredStartTime;
    private LocalDateTime desiredEndTime;
    private String vehicleType;
    private Integer priorityLevel;
    private String customerTier;
    private String status;
    private String reason;
    private LocalDateTime offeredAt;
    private LocalDateTime offerExpiresAt;
    private LocalDateTime acceptedAt;
    private LocalDateTime canceledAt;
    private LocalDateTime expiredAt;
    private LocalDateTime createdAt;
}