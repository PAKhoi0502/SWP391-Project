package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.request.VehicleInspectionCreateRequest;
import com.autowashpro.dto.request.VehicleInspectionUpdateRequest;
import com.autowashpro.dto.response.VehicleInspectionResponse;
import com.autowashpro.service.VehicleInspectionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class VehicleInspectionController {

    private final VehicleInspectionService vehicleInspectionService;

    @PostMapping("/bookings/{bookingId}/inspections")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public ApiResponse<VehicleInspectionResponse> create(
            @PathVariable Long bookingId,
            @Valid @RequestBody VehicleInspectionCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        Long currentUserId = Long.valueOf(userDetails.getUsername());
        String role = userDetails.getAuthorities().iterator().next().getAuthority();
        return ApiResponse.<VehicleInspectionResponse>builder()
                .success(true)
                .message("Inspection created successfully")
                .data(vehicleInspectionService.create(bookingId, request, currentUserId, role))
                .build();
    }

    @GetMapping("/bookings/{bookingId}/inspections")
    @PreAuthorize("hasRole('CUSTOMER') or hasRole('STAFF') or hasRole('ADMIN')")
    public ApiResponse<List<VehicleInspectionResponse>> listByBooking(
            @PathVariable Long bookingId,
            @AuthenticationPrincipal UserDetails userDetails) {

        Long currentUserId = Long.valueOf(userDetails.getUsername());
        String role = userDetails.getAuthorities().iterator().next().getAuthority();
        return ApiResponse.<List<VehicleInspectionResponse>>builder()
                .success(true)
                .message("Inspections retrieved")
                .data(vehicleInspectionService.listByBooking(bookingId, currentUserId, role))
                .build();
    }

    @GetMapping("/vehicle-inspections/{id}")
    @PreAuthorize("hasRole('CUSTOMER') or hasRole('STAFF') or hasRole('ADMIN')")
    public ApiResponse<VehicleInspectionResponse> getById(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {

        Long currentUserId = Long.valueOf(userDetails.getUsername());
        String role = userDetails.getAuthorities().iterator().next().getAuthority();
        return ApiResponse.<VehicleInspectionResponse>builder()
                .success(true)
                .message("Inspection retrieved")
                .data(vehicleInspectionService.getById(id, currentUserId, role))
                .build();
    }

    @PatchMapping("/vehicle-inspections/{id}")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public ApiResponse<VehicleInspectionResponse> update(
            @PathVariable Long id,
            @RequestBody VehicleInspectionUpdateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        Long currentUserId = Long.valueOf(userDetails.getUsername());
        String role = userDetails.getAuthorities().iterator().next().getAuthority();
        return ApiResponse.<VehicleInspectionResponse>builder()
                .success(true)
                .message("Inspection updated successfully")
                .data(vehicleInspectionService.update(id, request, currentUserId, role))
                .build();
    } 
}
