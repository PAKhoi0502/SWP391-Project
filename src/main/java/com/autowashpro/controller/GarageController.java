package com.autowashpro.controller;

import com.autowashpro.common.AuditAction;
import com.autowashpro.common.AuditActorContext;
import com.autowashpro.common.AuditMetadata;
import com.autowashpro.common.AuditTargetType;
import com.autowashpro.dto.request.GarageCreateRequest;
import com.autowashpro.dto.request.GarageStatusUpdateRequest;
import com.autowashpro.dto.request.GarageUpdateRequest;
import com.autowashpro.dto.response.GarageCapabilitiesResponse;
import com.autowashpro.dto.response.GarageResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.service.GarageService;
import com.autowashpro.service.AuditLogService;
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
    private final AuditLogService auditLogService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GarageResponse> create(@Valid @RequestBody GarageCreateRequest request) {
        GarageResponse response = garageService.create(request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.GARAGE_CREATED,
                AuditTargetType.GARAGE,
                response.getId(),
                AuditMetadata.of("garageCode", response.getGarageCode(), "isActive", response.getIsActive()));
        return ResponseEntity.ok(response);
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
        GarageResponse response = garageService.update(id, request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.GARAGE_UPDATED,
                AuditTargetType.GARAGE,
                id,
                AuditMetadata.of("garageCode", response.getGarageCode()));
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GarageResponse> updateStatus(@PathVariable Long id,
                                                         @Valid @RequestBody GarageStatusUpdateRequest request) {
        GarageResponse response = garageService.updateStatus(id, request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.GARAGE_STATUS_UPDATED,
                AuditTargetType.GARAGE,
                id,
                AuditMetadata.of("isActive", response.getIsActive()));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/capabilities")
    public ResponseEntity<GarageCapabilitiesResponse> getCapabilities(@PathVariable Long id) {
        return ResponseEntity.ok(garageService.getCapabilities(id));
    }
}
