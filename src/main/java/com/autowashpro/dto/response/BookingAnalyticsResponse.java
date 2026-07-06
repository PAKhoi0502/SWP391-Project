package com.autowashpro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingAnalyticsResponse {
    private LocalDate from;
    private LocalDate to;
    private Long garageId;
    private Long totalBookings;
    private Map<String, Long> byStatus;
    private List<GarageBookingCount> byGarage;
    private List<DateBookingCount> byDate;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GarageBookingCount {
        private Long garageId;
        private Long bookingCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DateBookingCount {
        private LocalDate date;
        private Long bookingCount;
    }
}
