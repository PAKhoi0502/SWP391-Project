package com.autowashpro.service;

import com.autowashpro.dto.request.GarageCreateRequest;
import com.autowashpro.dto.request.GarageStatusUpdateRequest;
import com.autowashpro.dto.request.GarageUpdateRequest;
import com.autowashpro.dto.response.GarageCapabilitiesResponse;
import com.autowashpro.dto.response.GarageResponse;
import com.autowashpro.dto.response.PageResponse;

public interface GarageService {
    GarageResponse create(GarageCreateRequest request);
    GarageResponse getById(Long id);
    GarageResponse update(Long id, GarageUpdateRequest request);
    GarageResponse updateStatus(Long id, GarageStatusUpdateRequest request);
    PageResponse<GarageResponse> list(int page, int limit, Boolean isActive, String keyword);
    GarageCapabilitiesResponse getCapabilities(Long id);

    /**
     * Dùng cho Booking API (issue #11) — ném 400 nếu garage không active
     */
    void assertGarageIsActive(Long garageId);
}