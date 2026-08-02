package com.autowashpro.dto.request;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class CreateSpecialDayRequest {

    private String dayName;

    private LocalDate startDate;

    private LocalDate endDate;

    private BigDecimal surchargeRate;
}
