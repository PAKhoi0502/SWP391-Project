package com.autowashpro.service;

import com.autowashpro.dto.request.BookingCreateRequest;
import com.autowashpro.dto.request.WalkInBookingCreateRequest;
import com.autowashpro.dto.response.AvailableSlotResponse;
import com.autowashpro.dto.response.BookingResponse;

import java.time.LocalDate;

public interface BookingService {

    AvailableSlotResponse getAvailableSlots(
            Long garageId,
            Long servicePackageId,
            String vehicleType,
            LocalDate date);

    BookingResponse createBooking(BookingCreateRequest request, Long customerId);

    BookingResponse createWalkInBooking(WalkInBookingCreateRequest request, Long staffUserId);
}