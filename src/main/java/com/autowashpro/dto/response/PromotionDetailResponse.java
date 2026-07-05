package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class PromotionDetailResponse {

    private Long id;

    private String code;

    private String name;

    private String description;

    private String discountType;

    private BigDecimal discountValue;

    private BigDecimal maxDiscountAmount;

    private BigDecimal minOrderAmount;

    private Integer usageLimit;

    private Integer usedCount;

    private Integer perUserLimit;

    private LocalDateTime startAt;

    private LocalDateTime endAt;

    private Boolean isActive;

    private Boolean allowLoyaltyStack;

    private Integer maxLoyaltyPoints;

    private List<String> applicableTiers;

}