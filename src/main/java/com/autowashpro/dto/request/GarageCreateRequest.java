package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalTime;

@Data
public class GarageCreateRequest {

    @NotBlank
    private String name;

    @NotBlank
    private String garageCode;

    @NotBlank
    private String address;

    @NotBlank
    private String city;

    @NotBlank
    private String phone;

    @NotNull
    private LocalTime openingTime;

    @NotNull
    private LocalTime closingTime;

    @NotNull
    private Integer slotIntervalMinutes;
}