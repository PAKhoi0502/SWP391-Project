package com.autowashpro.controller;

import com.autowashpro.common.AuditAction;
import com.autowashpro.common.AuditActorContext;
import com.autowashpro.common.AuditMetadata;
import com.autowashpro.common.AuditTargetType;
import com.autowashpro.dto.request.StaffProfileCreateRequest;
import com.autowashpro.dto.request.StaffProfileStatusUpdateRequest;
import com.autowashpro.dto.request.StaffProfileUpdateRequest;
import com.autowashpro.dto.response.CareBoardResponse;
import com.autowashpro.dto.response.CareTaskResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.dto.response.StaffCompletedServiceResponse;
import com.autowashpro.dto.response.StaffDashboardStatsResponse;
import com.autowashpro.dto.response.StaffProfileResponse;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.service.StaffProfileService;
import com.autowashpro.service.AuditLogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/staff-profiles")
@RequiredArgsConstructor
public class StaffProfileController {

    private final StaffProfileService staffProfileService;
    private final AuditLogService auditLogService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StaffProfileResponse> create(@Valid @RequestBody StaffProfileCreateRequest request) {
        StaffProfileResponse response = staffProfileService.create(request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.STAFF_PROFILE_CREATED,
                AuditTargetType.STAFF_PROFILE,
                response.getId(),
                AuditMetadata.of("userId", response.getUserId(), "garageId", response.getGarageId(), "staffType", response.getStaffType()));
        return ResponseEntity.ok(response);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PageResponse<StaffProfileResponse>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) Long garageId,
            @RequestParam(required = false) StaffType staffType,
            @RequestParam(required = false) Boolean isActive
    ) {
        return ResponseEntity.ok(staffProfileService.list(page, limit, garageId, staffType, isActive));
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<StaffProfileResponse> getMyProfile(Authentication authentication) {
        Long currentUserId = Long.valueOf(authentication.getName());
        return ResponseEntity.ok(staffProfileService.getByUserId(currentUserId));
    }

    @GetMapping("/me/dashboard-stats")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<StaffDashboardStatsResponse> getMyDashboardStats(Authentication authentication) {
        Long currentUserId = Long.valueOf(authentication.getName());
        return ResponseEntity.ok(staffProfileService.getMyDashboardStats(currentUserId));
    }

    @GetMapping("/me/completed-services")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<List<StaffCompletedServiceResponse>> getMyCompletedServices(
            Authentication authentication,
            @RequestParam(defaultValue = "20") int limit) {
        Long currentUserId = Long.valueOf(authentication.getName());
        return ResponseEntity.ok(staffProfileService.getMyCompletedServices(currentUserId, limit));
    }

    @GetMapping("/me/care-board")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<CareBoardResponse> getMyCareBoard(Authentication authentication) {
        Long currentUserId = Long.valueOf(authentication.getName());
        return ResponseEntity.ok(staffProfileService.getMyCareBoard(currentUserId));
    }

    @PatchMapping("/me/care-tasks/{assignmentId}/start")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<CareTaskResponse> startCareTask(Authentication authentication, @PathVariable Long assignmentId) {
        Long currentUserId = Long.valueOf(authentication.getName());
        return ResponseEntity.ok(staffProfileService.startCareTask(currentUserId, assignmentId));
    }

    @PatchMapping("/me/care-tasks/{assignmentId}/complete")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<CareTaskResponse> completeCareTask(Authentication authentication, @PathVariable Long assignmentId) {
        Long currentUserId = Long.valueOf(authentication.getName());
        return ResponseEntity.ok(staffProfileService.completeCareTask(currentUserId, assignmentId));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StaffProfileResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(staffProfileService.getById(id));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StaffProfileResponse> update(@PathVariable Long id,
                                                         @RequestBody StaffProfileUpdateRequest request) {
        StaffProfileResponse response = staffProfileService.update(id, request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.STAFF_PROFILE_UPDATED,
                AuditTargetType.STAFF_PROFILE,
                id,
                AuditMetadata.of("garageId", response.getGarageId(), "staffType", response.getStaffType()));
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StaffProfileResponse> updateStatus(@PathVariable Long id,
                                                               @Valid @RequestBody StaffProfileStatusUpdateRequest request) {
        StaffProfileResponse response = staffProfileService.updateStatus(id, request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.STAFF_PROFILE_STATUS_UPDATED,
                AuditTargetType.STAFF_PROFILE,
                id,
                AuditMetadata.of("isActive", response.getIsActive()));
        return ResponseEntity.ok(response);
    }
}
