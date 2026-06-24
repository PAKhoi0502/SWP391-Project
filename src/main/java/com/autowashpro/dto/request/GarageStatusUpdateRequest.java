package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class GarageStatusUpdateRequest {
    @NotNull
    private Boolean isActive;
}