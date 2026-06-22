package com.autowashpro.controller;

import com.autowashpro.dto.request.*;
import com.autowashpro.dto.response.UserDetailResponse;
import com.autowashpro.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

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

        return userService.updateStatus(id, request);
    }

    @PatchMapping("/{id}/role")
    public UserDetailResponse updateRole(
            @PathVariable Long id,
            @RequestBody UpdateUserRoleRequest request) {

        return userService.updateRole(id, request);
    }
}