package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class CreateWaitlistRequest {

    @NotNull
    private Long garageId;

    @NotNull
    private Long vehicleId;

    @NotNull
    private Long servicePackageId;

    private List<Long> addOnServicePackageIds;

    @NotNull
    private LocalDateTime desiredStartTime;

    @NotNull
    private String reason; // NO_BAY | NO_CARE_STAFF
}