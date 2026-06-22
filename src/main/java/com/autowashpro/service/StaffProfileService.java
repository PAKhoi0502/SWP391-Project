package com.autowashpro.service;

import com.autowashpro.dto.request.StaffProfileCreateRequest;
import com.autowashpro.dto.request.StaffProfileStatusUpdateRequest;
import com.autowashpro.dto.request.StaffProfileUpdateRequest;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.dto.response.StaffProfileResponse;
import com.autowashpro.entity.enums.StaffType;

public interface StaffProfileService {
    StaffProfileResponse create(StaffProfileCreateRequest request);
    StaffProfileResponse getById(Long id);
    StaffProfileResponse getByUserId(Long userId);
    StaffProfileResponse update(Long id, StaffProfileUpdateRequest request);
    StaffProfileResponse updateStatus(Long id, StaffProfileStatusUpdateRequest request);
    PageResponse<StaffProfileResponse> list(int page, int limit, Long garageId, StaffType staffType, Boolean isActive);
    void assertStaffCanOperateInGarage(Long userId, Long garageId);
}