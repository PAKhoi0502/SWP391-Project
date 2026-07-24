package com.autowashpro.controller;

import com.autowashpro.common.AuditAction;
import com.autowashpro.common.AuditActorContext;
import com.autowashpro.common.AuditMetadata;
import com.autowashpro.common.AuditTargetType;
import com.autowashpro.dto.request.CreateServicePackageRequest;
import com.autowashpro.dto.request.UpdateServicePackageRequest;
import com.autowashpro.dto.request.UpdateServicePackageStatusRequest;
import com.autowashpro.dto.response.ServicePackageResponse;
import com.autowashpro.service.ServicePackageService;
import com.autowashpro.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/service-packages")
@RequiredArgsConstructor
public class ServicePackageController {

    private final ServicePackageService servicePackageService;
    private final AuditLogService auditLogService;

    @PostMapping
    public ServicePackageResponse create(
            @RequestBody CreateServicePackageRequest request) {

        ServicePackageResponse response = servicePackageService.create(request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.SERVICE_PACKAGE_CREATED,
                AuditTargetType.SERVICE_PACKAGE,
                response.getId(),
                AuditMetadata.of("code", response.getCode(), "isActive", response.getIsActive()));
        return response;
    }

    @GetMapping
    public List<ServicePackageResponse> getAll() {

        return servicePackageService.getAll();
    }

    @GetMapping("/{id}")
    public ServicePackageResponse getById(
            @PathVariable Long id) {

        return servicePackageService.getById(id);
    }

    @PatchMapping("/{id}")
    public ServicePackageResponse update(
            @PathVariable Long id,
            @RequestBody UpdateServicePackageRequest request) {

        ServicePackageResponse response = servicePackageService.update(id, request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.SERVICE_PACKAGE_UPDATED,
                AuditTargetType.SERVICE_PACKAGE,
                id,
                AuditMetadata.of("code", response.getCode(), "isActive", response.getIsActive()));
        return response;
    }

    @PatchMapping("/{id}/status")
    public ServicePackageResponse updateStatus(
            @PathVariable Long id,
            @RequestBody UpdateServicePackageStatusRequest request) {

        ServicePackageResponse response = servicePackageService.updateStatus(id, request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.SERVICE_PACKAGE_STATUS_UPDATED,
                AuditTargetType.SERVICE_PACKAGE,
                id,
                AuditMetadata.of("isActive", response.getIsActive()));
        return response;
    }

    @GetMapping("/available")
    public List<ServicePackageResponse> getAvailable(
            @RequestParam(required = false) String vehicleType,
            @RequestParam(required = false) Long garageId) {

        return servicePackageService
                .getAvailable(vehicleType, garageId);
    }
}
