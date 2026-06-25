package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.request.BookingCreateRequest;
import com.autowashpro.dto.response.AvailableSlotResponse;
import com.autowashpro.dto.response.BookingResponse;
import com.autowashpro.service.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;

    // Giữ nguyên từ phong-bk (issue #10)
    @GetMapping("/available-slots")
    public ApiResponse<AvailableSlotResponse> getAvailableSlots(
            @RequestParam("garage_id") Long garageId,
            @RequestParam("service_package_id") Long servicePackageId,
            @RequestParam("vehicle_type") String vehicleType,
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {

        return ApiResponse.<AvailableSlotResponse>builder()
                .success(true)
                .message("Available slots retrieved")
                .data(bookingService.getAvailableSlots(garageId, servicePackageId, vehicleType, date))
                .build();
    }

    // Thêm mới cho issue #11
    @PostMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<BookingResponse> createBooking(
            @Valid @RequestBody BookingCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<BookingResponse>builder()
                .success(true)
                .message("Booking created successfully")
                .data(bookingService.createBooking(request, customerId))
                .build();
    }
}