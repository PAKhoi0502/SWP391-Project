package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

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

    private Boolean allowLoyaltyStack;

    private Integer maxLoyaltyPoints;

    private LocalDateTime startAt;

    private LocalDateTime endAt;

    private Integer perUserLimit;

    private List<String> applicableTiers;

}