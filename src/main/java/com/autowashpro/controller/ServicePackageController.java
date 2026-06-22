package com.autowashpro.controller;

import com.autowashpro.dto.request.CreateServicePackageRequest;
import com.autowashpro.dto.request.UpdateServicePackageRequest;
import com.autowashpro.dto.request.UpdateServicePackageStatusRequest;
import com.autowashpro.dto.response.ServicePackageResponse;
import com.autowashpro.service.ServicePackageService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/service-packages")
@RequiredArgsConstructor
public class ServicePackageController {

    private final ServicePackageService servicePackageService;

    @PostMapping
    public ServicePackageResponse create(
            @RequestBody CreateServicePackageRequest request) {

        return servicePackageService.create(request);
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

        return servicePackageService.update(
                id,
                request);
    }

    @PatchMapping("/{id}/status")
    public ServicePackageResponse updateStatus(
            @PathVariable Long id,
            @RequestBody UpdateServicePackageStatusRequest request) {

        return servicePackageService.updateStatus(
                id,
                request);
    }

    @GetMapping("/available")
    public List<ServicePackageResponse> getAvailable(
            @RequestParam String vehicleType) {

        return servicePackageService
                .getAvailable(vehicleType);
    }
}