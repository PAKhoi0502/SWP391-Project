package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
@Builder
public class GarageResponse {
    private Long id;
    private String name;
    private String garageCode;
    private String address;
    private String city;
    private String phone;
    private LocalTime openingTime;
    private LocalTime closingTime;
    private Integer slotIntervalMinutes;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}