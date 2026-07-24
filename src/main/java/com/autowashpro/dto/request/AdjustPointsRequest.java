package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AdjustPointsRequest {
    @NotNull
    private Long customerId;
    @NotNull
    private Integer points;
    @NotNull
    private String type;
    @NotBlank(message = "Reason is required for loyalty point adjustment")
    private String reason;
}
