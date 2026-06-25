package com.autowashpro.service;

import com.autowashpro.dto.request.BookingCreateRequest;
import com.autowashpro.dto.response.AvailableSlotResponse;
import com.autowashpro.dto.response.BookingResponse;

import java.time.LocalDate;

public interface BookingService {

    // Giữ nguyên từ phong-bk (issue #10)
    AvailableSlotResponse getAvailableSlots(
            Long garageId,
            Long servicePackageId,
            String vehicleType,
            LocalDate date);

    // Thêm mới cho issue #11
    BookingResponse createBooking(BookingCreateRequest request, Long customerId);
}