package com.autowashpro.dto.response;

import com.autowashpro.entity.enums.WashBayStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class WashBayResponse {
    private Long id;
    private Long garageId;
    private String bayCode;
    private String vehicleType;
    private WashBayStatus status;
    private Long currentBookingId;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}