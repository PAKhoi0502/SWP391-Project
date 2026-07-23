package com.autowashpro.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServicePackageResponse {

    private Long id;

    private String name;

    private String code;

    private String vehicleType;

    private String serviceType;

    private Integer seatCount;

    private String motorbikeGroup;

    private BigDecimal basePrice;

    private Integer durationMinutes;

    private Integer washBayDurationMinutes;

    private Integer pointsEarned;

    private Boolean requiresWashBay;

    private Boolean requiresCareStaff;

    private String careStaffType;

    private Integer careStaffRequiredCount;

    private Integer careStaffDurationMinutes;

    private Boolean isActive;

    private List<Long> includedServiceIds;

    private List<ServicePackageStepResponse> steps;

    private List<Long> garageIds;
}