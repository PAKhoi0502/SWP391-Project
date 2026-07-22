package com.autowashpro.dto.request;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateServicePackageStepRequest {

    private Integer stepOrder;

    private String name;

    private String description;

    private Boolean isRequired;

    private List<String> instructions;

    /** Which execution phase this step belongs to: AUTOMATED_WASH, VEHICLE_CARE, FINAL_INSPECTION */
    private String executionPhase;

    /** Estimated duration of this step in minutes (>= 0, default 0) */
    private Integer durationMinutes;
}