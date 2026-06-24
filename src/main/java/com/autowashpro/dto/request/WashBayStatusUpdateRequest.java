package com.autowashpro.dto.request;

import com.autowashpro.entity.enums.WashBayStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class WashBayStatusUpdateRequest {
    @NotNull
    private WashBayStatus status;
}