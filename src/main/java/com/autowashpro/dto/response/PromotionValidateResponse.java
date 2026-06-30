package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class PromotionValidateResponse {

    private boolean valid;

    private String message;

    private Long promotionId;

    private String promotionCode;

    private BigDecimal discountAmount;

    private BigDecimal finalAmount;

}