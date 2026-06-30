package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class PromotionUsageResponse {

    private Long id;

    private Long promotionId;

    private Long bookingId;

    private Long customerId;

    private BigDecimal discountAmount;

    private LocalDateTime usedAt;

}