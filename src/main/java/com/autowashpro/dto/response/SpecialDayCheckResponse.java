package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class SpecialDayCheckResponse {

    private Boolean isSpecialDay;

    private BigDecimal surchargeRate;
}
