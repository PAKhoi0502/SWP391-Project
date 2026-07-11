package com.autowashpro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WashBayAnalyticsResponse {
    private LocalDate from;
    private LocalDate to;
    private Long garageId;
    private Long totalUsages;
    private Long totalUsageMinutes;
    private Double averageUsageMinutes;
    private List<WashBayPerformance> washBays;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WashBayPerformance {
        private Long washBayId;
        private String bayCode;
        private Long garageId;
        private String vehicleType;
        private Long usageCount;
        private Long usageMinutes;
        private Double averageUsageMinutes;
    }
}
