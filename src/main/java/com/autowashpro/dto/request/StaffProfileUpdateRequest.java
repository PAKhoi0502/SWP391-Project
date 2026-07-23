package com.autowashpro.dto.request;

import com.autowashpro.entity.enums.StaffType;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class StaffProfileUpdateRequest {
    private Long garageId;
    private StaffType staffType;
    private BigDecimal salary;
}