package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class StaffDashboardStatsResponse {
    private long totalCompletedServices;
    private long todayCompletedServices;
    private BigDecimal salary;
}
