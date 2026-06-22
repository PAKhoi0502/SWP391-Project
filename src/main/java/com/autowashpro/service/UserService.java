package com.autowashpro.service;

import com.autowashpro.dto.request.UpdateProfileRequest;
import com.autowashpro.dto.request.UpdateUserRoleRequest;
import com.autowashpro.dto.request.UpdateUserStatusRequest;
import com.autowashpro.dto.response.UserDetailResponse;

import java.util.List;

public interface UserService {

    UserDetailResponse getCurrentUser(Long userId);

    UserDetailResponse updateCurrentUser(
            Long userId,
            UpdateProfileRequest request);

    List<UserDetailResponse> getAllUsers();

    UserDetailResponse getUserById(Long id);

    UserDetailResponse updateStatus(
            Long id,
            UpdateUserStatusRequest request);

    UserDetailResponse updateRole(
            Long id,
            UpdateUserRoleRequest request);
}