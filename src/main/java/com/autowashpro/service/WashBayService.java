package com.autowashpro.service;

import com.autowashpro.dto.request.WashBayCreateRequest;
import com.autowashpro.dto.request.WashBayStatusUpdateRequest;
import com.autowashpro.dto.request.WashBayUpdateRequest;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.dto.response.WashBayCapacityResponse;
import com.autowashpro.dto.response.WashBayResponse;
import com.autowashpro.entity.enums.WashBayStatus;

import java.util.List;

public interface WashBayService {
    WashBayResponse create(WashBayCreateRequest request);
    WashBayResponse getById(Long id, Long callerId, String role);
    WashBayResponse update(Long id, WashBayUpdateRequest request);
    WashBayResponse updateStatus(Long id, WashBayStatusUpdateRequest request, Long callerId, String role);
    PageResponse<WashBayResponse> list(int page, int limit, Long garageId, String vehicleType, WashBayStatus status, Long callerId, String role);
    List<String> getSupportedVehicleTypes(Long garageId);
    WashBayCapacityResponse getCapacity(Long garageId, String vehicleType, Long callerId, String role);
}