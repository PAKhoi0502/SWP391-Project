package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VehicleCreateRequest {

    @NotBlank
    private String rawLicensePlate;

    @NotBlank
    private String vehicleType; // BIKE hoặc CAR

    private String engineType;

    @NotBlank
    private String brand;

    @NotBlank
    private String model;

    private String color;
    private Integer seatCount;
    private String motorbikeGroup;
    private Boolean isDefault = false;
}