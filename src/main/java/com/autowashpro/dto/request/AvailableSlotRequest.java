package com.autowashpro.dto.request;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class AvailableSlotRequest {

    private Long garageId;

    private Long servicePackageId;

    private String vehicleType;

    private LocalDate date;
}