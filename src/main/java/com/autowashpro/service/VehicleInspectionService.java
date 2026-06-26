package com.autowashpro.service;

import com.autowashpro.dto.request.VehicleInspectionCreateRequest;
import com.autowashpro.dto.request.VehicleInspectionUpdateRequest;
import com.autowashpro.dto.response.VehicleInspectionResponse;

import java.util.List;

public interface VehicleInspectionService {
    VehicleInspectionResponse create(Long bookingId, VehicleInspectionCreateRequest request, Long staffUserId);
    List<VehicleInspectionResponse> listByBooking(Long bookingId, Long currentUserId, String role);
    VehicleInspectionResponse getById(Long id, Long currentUserId, String role);
    VehicleInspectionResponse update(Long id, VehicleInspectionUpdateRequest request, Long staffUserId);
}