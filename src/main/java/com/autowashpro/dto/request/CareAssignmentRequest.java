package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CareAssignmentRequest {

    @NotNull(message = "staffProfileId is required")
    private Long staffProfileId;

    private String reason; // required when reassigning
}
