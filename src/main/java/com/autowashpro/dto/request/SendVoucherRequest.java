package com.autowashpro.dto.request;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class SendVoucherRequest {
    private String filterType; // ALL, MIN_VISITS, MIN_SPENT, TIER
    private Integer minVisits;
    private BigDecimal minSpent;
    private String tier;
}