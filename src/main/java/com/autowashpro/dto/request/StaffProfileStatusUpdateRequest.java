package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StaffProfileStatusUpdateRequest {
    @NotNull
    private Boolean isActive;
}