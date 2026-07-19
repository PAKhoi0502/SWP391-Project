package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ExtendLotExpiryRequest {
    @NotNull(message = "newExpiredAt is required")
    private LocalDateTime newExpiredAt;
    @NotBlank(message = "Reason is required for expiry extension")
    private String reason;
}
