package com.autowashpro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RevenueAnalyticsResponse {
    private LocalDate from;
    private LocalDate to;
    private Long garageId;
    private Long paidBookingCount;
    private BigDecimal totalRevenue;
    private BigDecimal averageRevenue;
    private List<DateRevenue> byDate;
    private List<GarageRevenue> byGarage;
    private List<PaymentMethodRevenue> byPaymentMethod;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DateRevenue {
        private LocalDate date;
        private Long paidBookingCount;
        private BigDecimal revenue;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GarageRevenue {
        private Long garageId;
        private Long paidBookingCount;
        private BigDecimal revenue;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PaymentMethodRevenue {
        private String paymentMethod;
        private Long paidBookingCount;
        private BigDecimal revenue;
    }
}
