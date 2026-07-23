package com.autowashpro.service;

import com.autowashpro.dto.request.StaffProfileCreateRequest;
import com.autowashpro.dto.request.StaffProfileStatusUpdateRequest;
import com.autowashpro.dto.request.StaffProfileUpdateRequest;
import com.autowashpro.dto.response.CareBoardResponse;
import com.autowashpro.dto.response.CareTaskResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.dto.response.StaffCompletedServiceResponse;
import com.autowashpro.dto.response.StaffDashboardStatsResponse;
import com.autowashpro.dto.response.StaffProfileResponse;
import com.autowashpro.entity.enums.StaffType;

import java.util.List;

public interface StaffProfileService {
    StaffProfileResponse create(StaffProfileCreateRequest request);
    StaffProfileResponse getById(Long id);
    StaffProfileResponse getByUserId(Long userId);
    StaffProfileResponse update(Long id, StaffProfileUpdateRequest request);
    StaffProfileResponse updateStatus(Long id, StaffProfileStatusUpdateRequest request);
    PageResponse<StaffProfileResponse> list(int page, int limit, Long garageId, StaffType staffType, Boolean isActive);
    void assertStaffCanOperateInGarage(Long userId, Long garageId);
    StaffDashboardStatsResponse getMyDashboardStats(Long userId);
    List<StaffCompletedServiceResponse> getMyCompletedServices(Long userId, int limit);
    CareBoardResponse getMyCareBoard(Long userId);
    CareTaskResponse startCareTask(Long userId, Long assignmentId);
    CareTaskResponse completeCareTask(Long userId, Long assignmentId);
}