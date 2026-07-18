package com.autowashpro.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingCalendarDayResponse {
    private String date;           // "2026-07-18"
    private int totalBookings;
    private Map<String, Integer> byStatus; // {"CONFIRMED": 2, "COMPLETED": 5, ...}
}
