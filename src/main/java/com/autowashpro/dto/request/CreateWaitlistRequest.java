package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CreateWaitlistRequest {

    @NotNull
    private Long garageId;

    @NotNull
    private Long vehicleId;

    @NotNull
    private Long servicePackageId;

    @NotNull
    private LocalDateTime desiredStartTime;

    @NotNull
    private String reason; // NO_BAY | NO_CARE_STAFF
}