package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RedeemPreviewRequest {
    @NotNull
    private Long servicePackageId;
    @NotNull
    private Integer points;
    private java.math.BigDecimal subtotalAfterPromotion;
}