package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.request.BookingCreateRequest;
import com.autowashpro.dto.request.WalkInBookingCreateRequest;
import com.autowashpro.dto.response.AvailableSlotResponse;
import com.autowashpro.dto.response.BookingResponse;
import com.autowashpro.dto.response.BookingSummaryResponse;
import com.autowashpro.service.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.util.List;

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
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {

        return ApiResponse.<AvailableSlotResponse>builder()
                .success(true)
                .message("Available slots retrieved")
                .data(bookingService.getAvailableSlots(garageId, servicePackageId, vehicleType, date))
                .build();
    }

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

    @PostMapping("/walk-in")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public ApiResponse<BookingResponse> createWalkInBooking(
            @Valid @RequestBody WalkInBookingCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        Long staffUserId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<BookingResponse>builder()
                .success(true)
                .message("Walk-in booking created successfully")
                .data(bookingService.createWalkInBooking(request, staffUserId))
                .build();
    }
    @GetMapping
@PreAuthorize("hasRole('CUSTOMER')")
public ApiResponse<List<BookingSummaryResponse>> getCustomerBookings(
        @AuthenticationPrincipal UserDetails userDetails,
        @RequestParam(required = false) String status) {

    Long customerId = Long.valueOf(userDetails.getUsername());

    return ApiResponse.<List<BookingSummaryResponse>>builder()
            .success(true)
            .message("Customer bookings retrieved")
            .data(
                    bookingService.getCustomerBookings(
                            customerId,
                            status))
            .build();
}
@GetMapping("/{id}")
@PreAuthorize("hasRole('CUSTOMER')")
public ApiResponse<BookingResponse> getCustomerBookingDetail(
        @PathVariable Long id,
        @AuthenticationPrincipal UserDetails userDetails) {

    Long customerId = Long.valueOf(userDetails.getUsername());

    return ApiResponse.<BookingResponse>builder()
            .success(true)
            .message("Booking detail retrieved")
            .data(
                    bookingService.getCustomerBookingDetail(
                            id,
                            customerId))
            .build();
}
@GetMapping("/staff/bookings")
@PreAuthorize("hasRole('STAFF')")
public ApiResponse<List<BookingSummaryResponse>> getStaffBookings(

        @AuthenticationPrincipal UserDetails userDetails,

        @RequestParam(required = false) String status,

        @RequestParam(required = false)

        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)

        LocalDate date) {

    Long staffUserId = Long.valueOf(userDetails.getUsername());

    return ApiResponse.<List<BookingSummaryResponse>>builder()
            .success(true)
            .message("Staff bookings retrieved")
            .data(
                    bookingService.getStaffBookings(
                            staffUserId,
                            status,
                            date))
            .build();
}
@GetMapping("/admin/bookings")
@PreAuthorize("hasRole('ADMIN')")
public ApiResponse<List<BookingSummaryResponse>> getAdminBookings(

        @RequestParam(required = false) Long garageId,

        @RequestParam(required = false) String status,

        @RequestParam(required = false) String paymentStatus) {

    return ApiResponse.<List<BookingSummaryResponse>>builder()
            .success(true)
            .message("Admin bookings retrieved")
            .data(
                    bookingService.getAdminBookings(
                            garageId,
                            status,
                            paymentStatus))
            .build();
}
}