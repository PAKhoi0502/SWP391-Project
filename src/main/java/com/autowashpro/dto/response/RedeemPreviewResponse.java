package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class RedeemPreviewResponse {
    private Integer requestedPoints;
    private Integer validPoints;
    private BigDecimal discountAmount;
    private BigDecimal originalPrice;
    private BigDecimal estimatedFinalPrice;
    private String message;
}