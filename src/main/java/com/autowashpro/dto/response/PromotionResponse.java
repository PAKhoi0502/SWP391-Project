package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class PromotionResponse {

    private Long id;

    private String code;

    private String name;

    private String description;

    private String discountType;

    private BigDecimal discountValue;

    private Boolean isActive;

    

}