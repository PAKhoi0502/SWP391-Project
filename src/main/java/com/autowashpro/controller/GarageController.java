package com.autowashpro.controller;

import com.autowashpro.dto.request.GarageCreateRequest;
import com.autowashpro.dto.request.GarageStatusUpdateRequest;
import com.autowashpro.dto.request.GarageUpdateRequest;
import com.autowashpro.dto.response.GarageCapabilitiesResponse;
import com.autowashpro.dto.response.GarageResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.service.GarageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/garages")
@RequiredArgsConstructor
public class GarageController {

    private final GarageService garageService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GarageResponse> create(@Valid @RequestBody GarageCreateRequest request) {
        return ResponseEntity.ok(garageService.create(request));
    }

    @GetMapping
    public ResponseEntity<PageResponse<GarageResponse>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) Boolean isActive,
            @RequestParam(required = false) String keyword
    ) {
        return ResponseEntity.ok(garageService.list(page, limit, isActive, keyword));
    }

    @GetMapping("/{id}")
    public ResponseEntity<GarageResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(garageService.getById(id));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GarageResponse> update(@PathVariable Long id,
                                                   @RequestBody GarageUpdateRequest request) {
        return ResponseEntity.ok(garageService.update(id, request));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GarageResponse> updateStatus(@PathVariable Long id,
                                                         @Valid @RequestBody GarageStatusUpdateRequest request) {
        return ResponseEntity.ok(garageService.updateStatus(id, request));
    }

    @GetMapping("/{id}/capabilities")
    public ResponseEntity<GarageCapabilitiesResponse> getCapabilities(@PathVariable Long id) {
        return ResponseEntity.ok(garageService.getCapabilities(id));
    }
}