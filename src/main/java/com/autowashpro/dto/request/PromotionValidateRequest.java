package com.autowashpro.dto.request;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class PromotionValidateRequest {

    private String promotionCode;

    private Long servicePackageId;

    private BigDecimal orderAmount;

}