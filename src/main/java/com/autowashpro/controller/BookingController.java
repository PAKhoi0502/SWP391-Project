package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.response.AvailableSlotResponse;
import com.autowashpro.service.BookingService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;

    @GetMapping("/available-slots")
    public ApiResponse<AvailableSlotResponse> getAvailableSlots(
            @RequestParam("garage_id") Long garageId,
            @RequestParam("service_package_id") Long servicePackageId,
            @RequestParam("vehicle_type") String vehicleType,
            @RequestParam("date")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate date) {

        return ApiResponse.<AvailableSlotResponse>builder()
                .success(true)
                .message("Available slots retrieved")
                .data(
                        bookingService.getAvailableSlots(
                                garageId,
                                servicePackageId,
                                vehicleType,
                                date))
                .build();
    }
}