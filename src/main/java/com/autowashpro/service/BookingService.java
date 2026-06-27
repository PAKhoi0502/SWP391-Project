package com.autowashpro.service;

import com.autowashpro.dto.request.BookingCreateRequest;
import com.autowashpro.dto.request.WalkInBookingCreateRequest;
import com.autowashpro.dto.response.AvailableSlotResponse;
import com.autowashpro.dto.response.BookingResponse;
import com.autowashpro.dto.response.BookingDetailResponse;
import com.autowashpro.dto.response.BookingSummaryResponse;
import com.autowashpro.dto.request.StartServiceRequest;

import java.time.LocalDate;
import java.util.List;

public interface BookingService {

        AvailableSlotResponse getAvailableSlots(
                        Long garageId,
                        Long servicePackageId,
                        String vehicleType,
                        LocalDate date);

        BookingResponse createBooking(BookingCreateRequest request, Long customerId);

        BookingResponse createWalkInBooking(WalkInBookingCreateRequest request, Long staffUserId);
        // ===================== ISSUE #13 =====================

        List<BookingSummaryResponse> getCustomerBookings(
                        Long customerId,
                        String status);

        BookingResponse getCustomerBookingDetail(
                        Long bookingId,
                        Long customerId);

        List<BookingSummaryResponse> getStaffBookings(
                        Long staffUserId,
                        String status,
                        LocalDate date);

        List<BookingSummaryResponse> getAdminBookings(
                        Long garageId,
                        String status,
                        String paymentStatus);

        // ===================== ISSUE #14 =====================
        BookingResponse checkInBooking(
                        Long bookingId,
                        Long staffUserId,
                        String note);

        // ===================== ISSUE #16 =====================
        BookingResponse startService(
                        Long bookingId,
                        Long staffUserId,
                        StartServiceRequest request);
}