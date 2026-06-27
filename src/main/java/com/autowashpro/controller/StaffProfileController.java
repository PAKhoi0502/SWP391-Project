package com.autowashpro.controller;

import com.autowashpro.dto.request.StaffProfileCreateRequest;
import com.autowashpro.dto.request.StaffProfileStatusUpdateRequest;
import com.autowashpro.dto.request.StaffProfileUpdateRequest;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.dto.response.StaffProfileResponse;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.service.StaffProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/staff-profiles")
@RequiredArgsConstructor
public class StaffProfileController {

    private final StaffProfileService staffProfileService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StaffProfileResponse> create(@Valid @RequestBody StaffProfileCreateRequest request) {
        return ResponseEntity.ok(staffProfileService.create(request));
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

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StaffProfileResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(staffProfileService.getById(id));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StaffProfileResponse> update(@PathVariable Long id,
                                                         @RequestBody StaffProfileUpdateRequest request) {
        return ResponseEntity.ok(staffProfileService.update(id, request));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StaffProfileResponse> updateStatus(@PathVariable Long id,
                                                               @Valid @RequestBody StaffProfileStatusUpdateRequest request) {
        return ResponseEntity.ok(staffProfileService.updateStatus(id, request));
    }
}
