package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.common.AuditAction;
import com.autowashpro.common.AuditActorContext;
import com.autowashpro.common.AuditMetadata;
import com.autowashpro.common.AuditTargetType;
import com.autowashpro.dto.request.*;
import com.autowashpro.dto.response.UserDetailResponse;
import com.autowashpro.service.UserService;
import com.autowashpro.service.AuditLogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final AuditLogService auditLogService;

    @GetMapping("/me")
    public UserDetailResponse me(
            Authentication authentication) {

        Long userId =
                Long.valueOf(authentication.getName());

        return userService.getCurrentUser(userId);
    }

    @PatchMapping("/me")
    public UserDetailResponse updateMe(
            Authentication authentication,
            @RequestBody UpdateProfileRequest request) {

        Long userId =
                Long.valueOf(authentication.getName());

        return userService.updateCurrentUser(
                userId,
                request);
    }

    @PatchMapping("/me/password")
    public ApiResponse<Void> changePassword(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordRequest request) {

        Long userId =
                Long.valueOf(authentication.getName());

        userService.changePassword(userId, request);

        return ApiResponse.<Void>builder()
                .success(true)
                .message("Password changed successfully")
                .build();
    }

    @GetMapping
    public List<UserDetailResponse> getAllUsers() {

        return userService.getAllUsers();
    }

    @GetMapping("/{id}")
    public UserDetailResponse getUser(
            @PathVariable Long id) {

        return userService.getUserById(id);
    }

    @PatchMapping("/{id}/status")
    public UserDetailResponse updateStatus(
            @PathVariable Long id,
            @RequestBody UpdateUserStatusRequest request) {

        UserDetailResponse response = userService.updateStatus(id, request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.USER_STATUS_UPDATED,
                AuditTargetType.USER,
                id,
                AuditMetadata.of("isActive", response.getIsActive()));
        return response;
    }

    @PatchMapping("/{id}/role")
    public UserDetailResponse updateRole(
            @PathVariable Long id,
            @RequestBody UpdateUserRoleRequest request) {

        UserDetailResponse response = userService.updateRole(id, request);
        auditLogService.createAuditLog(
                AuditActorContext.currentActorId(),
                AuditAction.USER_ROLE_UPDATED,
                AuditTargetType.USER,
                id,
                AuditMetadata.of("role", response.getRole()));
        return response;
    }
}
