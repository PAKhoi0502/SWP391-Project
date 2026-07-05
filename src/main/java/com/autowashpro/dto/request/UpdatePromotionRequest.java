package com.autowashpro.dto.request;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
public class UpdatePromotionRequest {

    private String name;

    private String description;

    private String discountType;

    private BigDecimal discountValue;

    private BigDecimal maxDiscountAmount;

    private BigDecimal minOrderAmount;

    private Integer usageLimit;

    private Integer perUserLimit;

    private LocalDateTime startAt;

    private LocalDateTime endAt;

    private Boolean isActive;

    private Boolean allowLoyaltyStack;

    private Integer maxLoyaltyPoints;

    private List<String> applicableTiers;
}