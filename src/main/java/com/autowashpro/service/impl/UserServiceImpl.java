package com.autowashpro.service.impl;

import com.autowashpro.common.UploadFolder;
import com.autowashpro.dto.request.*;
import com.autowashpro.dto.response.UserDetailResponse;
import com.autowashpro.entity.Upload;
import com.autowashpro.entity.User;
import com.autowashpro.repository.UploadRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final UploadRepository uploadRepository;

    private UserDetailResponse map(User user) {

        return UserDetailResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .role(user.getRole())
                .isActive(user.getIsActive())
                .build();
    }

    private UserDetailResponse mapCurrent(User user) {
        UserDetailResponse response = map(user);
        Upload avatar = uploadRepository
                .findFirstByOwnerIdAndEntityTypeAndEntityIdOrderByCreatedAtDesc(
                        user.getId(),
                        UploadFolder.AVATARS.getEntityType(),
                        user.getId())
                .orElse(null);

        if (avatar != null) {
            response.setAvatarUrl(avatar.getFileUrl());
            response.setAvatarPublicId(avatar.getPublicId());
        }

        return response;
    }

    @Override
    public UserDetailResponse getCurrentUser(Long userId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        return mapCurrent(user);
    }

    @Override
    public UserDetailResponse updateCurrentUser(
            Long userId,
            UpdateProfileRequest request) {

        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        if (!user.getEmail().equals(request.getEmail())
                && userRepository.existsByEmail(request.getEmail())) {

            throw new RuntimeException("Email already exists");
        }

        if (!user.getPhone().equals(request.getPhone())
                && userRepository.existsByPhone(request.getPhone())) {

            throw new RuntimeException("Phone already exists");
        }

        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());
        user.setUpdatedAt(LocalDateTime.now());

        userRepository.save(user);

        return mapCurrent(user);
    }

    @Override
    public List<UserDetailResponse> getAllUsers() {

        return userRepository.findAll()
                .stream()
                .map(this::map)
                .toList();
    }

    @Override
    public UserDetailResponse getUserById(Long id) {

        User user = userRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        return map(user);
    }

    @Override
    public UserDetailResponse updateStatus(
            Long id,
            UpdateUserStatusRequest request) {

        User user = userRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        user.setIsActive(request.getIsActive());

        userRepository.save(user);

        return map(user);
    }

    @Override
    public UserDetailResponse updateRole(
            Long id,
            UpdateUserRoleRequest request) {

        if (!List.of(
                "CUSTOMER",
                "STAFF",
                "ADMIN"
        ).contains(request.getRole())) {

            throw new RuntimeException("Invalid role");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        user.setRole(request.getRole());

        userRepository.save(user);

        return map(user);
    }
}
