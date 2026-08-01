package com.autowashpro.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AvailablePackageAtTimeResponse {

    private Long servicePackageId;

    private String name;

    private String serviceType; // MAIN | COMBO — ADD_ON packages are never returned here

    private String vehicleType;

    private BigDecimal basePrice;

    private Integer durationMinutes;

    private Integer washBayDurationMinutes;

    private Integer careStaffDurationMinutes;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private LocalDateTime washEndAt;

    private LocalDateTime careEndAt;
}
