package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.response.AuditLogResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/admin/audit-logs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AuditLogController {

    private final AuditLogService auditLogService;

    @GetMapping
    public ApiResponse<PageResponse<AuditLogResponse>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(name = "actor_id", required = false) Long actorId,
            @RequestParam(required = false) String action,
            @RequestParam(name = "target_type", required = false) String targetType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ApiResponse.<PageResponse<AuditLogResponse>>builder()
                .success(true)
                .message("Audit logs retrieved successfully")
                .data(auditLogService.list(page, limit, actorId, action, targetType, from, to))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<AuditLogResponse> getById(@PathVariable Long id) {
        return ApiResponse.<AuditLogResponse>builder()
                .success(true)
                .message("Audit log retrieved successfully")
                .data(auditLogService.getById(id))
                .build();
    }
}
