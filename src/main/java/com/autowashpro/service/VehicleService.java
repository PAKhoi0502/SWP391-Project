package com.autowashpro.service;

import com.autowashpro.dto.request.VehicleCreateRequest;
import com.autowashpro.dto.request.VehicleStatusUpdateRequest;
import com.autowashpro.dto.request.VehicleUpdateRequest;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.dto.response.VehicleResponse;

import java.util.List;

public interface VehicleService {
    VehicleResponse create(VehicleCreateRequest request, Long customerId);
    List<VehicleResponse> listOwn(Long customerId);
    VehicleResponse getOwnById(Long id, Long customerId);
    VehicleResponse update(Long id, VehicleUpdateRequest request, Long customerId);
    VehicleResponse setDefault(Long id, Long customerId);
    VehicleResponse updateStatus(Long id, VehicleStatusUpdateRequest request, Long customerId);
    PageResponse<VehicleResponse> adminList(int page, int limit, String vehicleType, String keyword);

    /**
     * Dùng cho Booking API — ném 400 nếu vehicle không active
     */
    void assertVehicleIsActive(Long vehicleId);
}