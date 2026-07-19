package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class DepositRefundEligibilityResponse {
    private boolean eligible;
    private BigDecimal refundAmount;
    private String reasonCode;
    private String message;
}
