package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class VehicleResponse {
    private Long id;
    private Long customerId;
    private String rawLicensePlate;
    private String normalizedLicensePlate;
    private String vehicleType;
    private String engineType;
    private String brand;
    private String model;
    private String color;
    private Integer seatCount;
    private String motorbikeGroup;
    private Boolean isDefault;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}