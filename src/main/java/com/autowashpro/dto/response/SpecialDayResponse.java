package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class SpecialDayResponse {

    private Long id;

    private String dayName;

    private LocalDate startDate;

    private LocalDate endDate;

    private Boolean isActive;

    private BigDecimal surchargeRate;
}
