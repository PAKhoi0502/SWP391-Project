package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.common.AuditAction;
import com.autowashpro.common.AuditActorContext;
import com.autowashpro.common.AuditMetadata;
import com.autowashpro.common.AuditTargetType;
import com.autowashpro.dto.request.CreateSpecialDayRequest;
import com.autowashpro.dto.request.UpdateSpecialDayRequest;
import com.autowashpro.dto.response.SpecialDayResponse;
import com.autowashpro.service.AuditLogService;
import com.autowashpro.service.SpecialDayService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin/special-days")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class SpecialDayController {

    private final SpecialDayService specialDayService;
    private final AuditLogService auditLogService;

    @GetMapping
    public ApiResponse<List<SpecialDayResponse>> getAll() {
        return ApiResponse.<List<SpecialDayResponse>>builder()
                .success(true)
                .message("Special days retrieved successfully")
                .data(specialDayService.getAll())
                .build();
    }

    @PostMapping
    public ApiResponse<SpecialDayResponse> create(@RequestBody CreateSpecialDayRequest request) {
        SpecialDayResponse response = specialDayService.create(request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.SPECIAL_DAY_CREATED,
                AuditTargetType.SPECIAL_DAY,
                response.getId(),
                AuditMetadata.of("dayName", response.getDayName(), "surchargeRate", response.getSurchargeRate()));
        return ApiResponse.<SpecialDayResponse>builder()
                .success(true)
                .message("Special day created successfully")
                .data(response)
                .build();
    }

    @PatchMapping("/{id}")
    public ApiResponse<SpecialDayResponse> update(
            @PathVariable Long id,
            @RequestBody UpdateSpecialDayRequest request) {
        SpecialDayResponse response = specialDayService.update(id, request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.SPECIAL_DAY_UPDATED,
                AuditTargetType.SPECIAL_DAY,
                id,
                AuditMetadata.of("dayName", response.getDayName(), "isActive", response.getIsActive(),
                        "surchargeRate", response.getSurchargeRate()));
        return ApiResponse.<SpecialDayResponse>builder()
                .success(true)
                .message("Special day updated successfully")
                .data(response)
                .build();
    }
}
