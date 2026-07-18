package com.autowashpro.service;

import com.autowashpro.dto.analytics.AdminDashboardBookingRowResponse;
import com.autowashpro.dto.analytics.BookingCalendarDayResponse;
import com.autowashpro.dto.response.PageResponse;

import java.util.List;

public interface AdminDashboardBookingService {
    PageResponse<AdminDashboardBookingRowResponse> getBookingManagement(
            int page,
            int limit,
            String tab,
            Long garageId,
            Long servicePackageId,
            String status,
            String date
    );

    List<BookingCalendarDayResponse> getBookingCalendar(
            int year,
            int month,
            Long garageId,
            Long servicePackageId
    );
}
