package com.autowashpro.dto.request;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateServicePackageRequest {

    private String name;

    private String vehicleType;

    private String serviceType;

    private BigDecimal basePrice;

    private Integer durationMinutes;

    private Integer washBayDurationMinutes;

    private Integer pointsEarned;

    private Boolean requiresWashBay;

    private Boolean requiresCareStaff;

    private String careStaffType;

    private Integer careStaffRequiredCount;

    private Integer careStaffDurationMinutes;
}