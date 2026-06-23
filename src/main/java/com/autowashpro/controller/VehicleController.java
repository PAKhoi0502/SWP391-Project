package com.autowashpro.controller;

import com.autowashpro.dto.request.VehicleCreateRequest;
import com.autowashpro.dto.request.VehicleStatusUpdateRequest;
import com.autowashpro.dto.request.VehicleUpdateRequest;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.dto.response.VehicleResponse;
import com.autowashpro.service.VehicleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class VehicleController {

    private final VehicleService vehicleService;

    @PostMapping("/api/vehicles")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<VehicleResponse> create(
            @Valid @RequestBody VehicleCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ResponseEntity.ok(vehicleService.create(request, customerId));
    }

    @GetMapping("/api/vehicles")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<List<VehicleResponse>> listOwn(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ResponseEntity.ok(vehicleService.listOwn(customerId));
    }

    @GetMapping("/api/vehicles/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<VehicleResponse> getById(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ResponseEntity.ok(vehicleService.getOwnById(id, customerId));
    }

    @PatchMapping("/api/vehicles/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<VehicleResponse> update(
            @PathVariable Long id,
            @RequestBody VehicleUpdateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ResponseEntity.ok(vehicleService.update(id, request, customerId));
    }

    @PatchMapping("/api/vehicles/{id}/default")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<VehicleResponse> setDefault(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ResponseEntity.ok(vehicleService.setDefault(id, customerId));
    }

    @PatchMapping("/api/vehicles/{id}/status")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<VehicleResponse> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody VehicleStatusUpdateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ResponseEntity.ok(vehicleService.updateStatus(id, request, customerId));
    }

    @GetMapping("/api/admin/vehicles")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PageResponse<VehicleResponse>> adminList(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String vehicleType,
            @RequestParam(required = false) String keyword) {
        return ResponseEntity.ok(vehicleService.adminList(page, limit, vehicleType, keyword));
    }
}