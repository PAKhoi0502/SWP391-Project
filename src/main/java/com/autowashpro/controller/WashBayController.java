package com.autowashpro.controller;

import com.autowashpro.common.AuditAction;
import com.autowashpro.common.AuditActorContext;
import com.autowashpro.common.AuditMetadata;
import com.autowashpro.common.AuditTargetType;
import com.autowashpro.dto.request.WashBayCreateRequest;
import com.autowashpro.dto.request.WashBayStatusUpdateRequest;
import com.autowashpro.dto.request.WashBayUpdateRequest;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.dto.response.WashBayCapacityResponse;
import com.autowashpro.dto.response.WashBayResponse;
import com.autowashpro.entity.enums.WashBayStatus;
import com.autowashpro.service.WashBayService;
import com.autowashpro.service.AuditLogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/wash-bays")
@RequiredArgsConstructor
public class WashBayController {

    private final WashBayService washBayService;
    private final AuditLogService auditLogService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<WashBayResponse> create(@Valid @RequestBody WashBayCreateRequest request) {
        WashBayResponse response = washBayService.create(request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.WASH_BAY_CREATED,
                AuditTargetType.WASH_BAY,
                response.getId(),
                AuditMetadata.of("garageId", response.getGarageId(), "status", response.getStatus()));
        return ResponseEntity.ok(response);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('STAFF')")
    public ResponseEntity<PageResponse<WashBayResponse>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) Long garageId,
            @RequestParam(required = false) String vehicleType,
            @RequestParam(required = false) WashBayStatus status,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        Long callerId = Long.valueOf(userDetails.getUsername());
        String role = userDetails.getAuthorities().stream().findFirst().orElseThrow().getAuthority();
        return ResponseEntity.ok(washBayService.list(page, limit, garageId, vehicleType, status, callerId, role));
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
            @RequestParam(required = false) String vehicleType,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        Long callerId = Long.valueOf(userDetails.getUsername());
        String role = userDetails.getAuthorities().stream().findFirst().orElseThrow().getAuthority();
        return ResponseEntity.ok(washBayService.getCapacity(garageId, vehicleType, callerId, role));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('STAFF')")
    public ResponseEntity<WashBayResponse> getById(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        Long callerId = Long.valueOf(userDetails.getUsername());
        String role = userDetails.getAuthorities().stream().findFirst().orElseThrow().getAuthority();
        return ResponseEntity.ok(washBayService.getById(id, callerId, role));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<WashBayResponse> update(@PathVariable Long id,
                                                    @RequestBody WashBayUpdateRequest request) {
        WashBayResponse response = washBayService.update(id, request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.WASH_BAY_UPDATED,
                AuditTargetType.WASH_BAY,
                id,
                AuditMetadata.of("garageId", response.getGarageId(), "vehicleType", response.getVehicleType()));
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN') or hasRole('STAFF')")
    public ResponseEntity<WashBayResponse> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody WashBayStatusUpdateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long callerId = Long.valueOf(userDetails.getUsername());
        String role = userDetails.getAuthorities().stream().findFirst().orElseThrow().getAuthority();
        WashBayResponse response = washBayService.updateStatus(id, request, callerId, role);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.WASH_BAY_STATUS_UPDATED,
                AuditTargetType.WASH_BAY,
                id,
                AuditMetadata.of("status", response.getStatus(), "isActive", response.getIsActive()));
        return ResponseEntity.ok(response);
    }
}
