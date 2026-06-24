package com.autowashpro.controller;

import com.autowashpro.dto.request.WashBayCreateRequest;
import com.autowashpro.dto.request.WashBayStatusUpdateRequest;
import com.autowashpro.dto.request.WashBayUpdateRequest;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.dto.response.WashBayCapacityResponse;
import com.autowashpro.dto.response.WashBayResponse;
import com.autowashpro.entity.enums.WashBayStatus;
import com.autowashpro.service.WashBayService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/wash-bays")
@RequiredArgsConstructor
public class WashBayController {

    private final WashBayService washBayService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<WashBayResponse> create(@Valid @RequestBody WashBayCreateRequest request) {
        return ResponseEntity.ok(washBayService.create(request));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('STAFF')")
    public ResponseEntity<PageResponse<WashBayResponse>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) Long garageId,
            @RequestParam(required = false) String vehicleType,
            @RequestParam(required = false) WashBayStatus status
    ) {
        return ResponseEntity.ok(washBayService.list(page, limit, garageId, vehicleType, status));
    }

    // QUAN TRỌNG: 2 endpoint /garages/:id/... phải đặt TRƯỚC /{id}
    // vì Spring sẽ map /garages/... vào /{id} nếu đặt sau
    @GetMapping("/garages/{garageId}/supported-vehicle-types")
    public ResponseEntity<List<String>> getSupportedVehicleTypes(@PathVariable Long garageId) {
        return ResponseEntity.ok(washBayService.getSupportedVehicleTypes(garageId));
    }

    @GetMapping("/garages/{garageId}/capacity")
    @PreAuthorize("hasRole('ADMIN') or hasRole('STAFF')")
    public ResponseEntity<WashBayCapacityResponse> getCapacity(
            @PathVariable Long garageId,
            @RequestParam(required = false) String vehicleType
    ) {
        return ResponseEntity.ok(washBayService.getCapacity(garageId, vehicleType));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('STAFF')")
    public ResponseEntity<WashBayResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(washBayService.getById(id));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<WashBayResponse> update(@PathVariable Long id,
                                                    @RequestBody WashBayUpdateRequest request) {
        return ResponseEntity.ok(washBayService.update(id, request));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN') or hasRole('STAFF')")
    public ResponseEntity<WashBayResponse> updateStatus(@PathVariable Long id,
                                                          @Valid @RequestBody WashBayStatusUpdateRequest request) {
        return ResponseEntity.ok(washBayService.updateStatus(id, request));
    }
}