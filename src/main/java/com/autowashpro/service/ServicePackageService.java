package com.autowashpro.service;

import com.autowashpro.dto.request.CreateServicePackageRequest;
import com.autowashpro.dto.request.UpdateServicePackageRequest;
import com.autowashpro.dto.request.UpdateServicePackageStatusRequest;
import com.autowashpro.dto.response.ServicePackageResponse;

import java.util.List;

public interface ServicePackageService {

    ServicePackageResponse create(
            CreateServicePackageRequest request);

    List<ServicePackageResponse> getAll();

    ServicePackageResponse getById(Long id);

    ServicePackageResponse update(
            Long id,
            UpdateServicePackageRequest request);

    ServicePackageResponse updateStatus(
            Long id,
            UpdateServicePackageStatusRequest request);

    List<ServicePackageResponse> getAvailable(
        String vehicleType,
        Long garageId);
}