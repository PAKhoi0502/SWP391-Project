package com.autowashpro.service.impl;

import com.autowashpro.common.UploadFolder;
import com.autowashpro.dto.request.*;
import com.autowashpro.dto.response.UserDetailResponse;
import com.autowashpro.entity.RefreshToken;
import com.autowashpro.entity.Upload;
import com.autowashpro.entity.User;
import com.autowashpro.repository.RefreshTokenRepository;
import com.autowashpro.repository.UploadRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final UploadRepository uploadRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;

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

        if (!Objects.equals(user.getEmail(), request.getEmail())
                && userRepository.existsByEmail(request.getEmail())) {

            throw new RuntimeException("Email already exists");
        }

        if (!Objects.equals(user.getPhone(), request.getPhone())
                && request.getPhone() != null
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
    public void changePassword(Long userId, ChangePasswordRequest request) {

        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        List<RefreshToken> refreshTokens = refreshTokenRepository.findAllByUser_Id(userId);
        refreshTokens.forEach(token -> token.setIsRevoked(true));
        refreshTokenRepository.saveAll(refreshTokens);
    }

    @Override
    public List<UserDetailResponse> getAllUsers() {

        List<User> users = userRepository.findAll();
        List<Long> userIds = users.stream().map(User::getId).toList();

        Map<Long, Upload> avatarsByOwnerId = uploadRepository
                .findByOwnerIdInAndEntityTypeOrderByCreatedAtDesc(userIds, UploadFolder.AVATARS.getEntityType())
                .stream()
                .collect(Collectors.toMap(Upload::getOwnerId, upload -> upload, (latest, older) -> latest));

        return users.stream()
                .map(user -> {
                    UserDetailResponse response = map(user);
                    Upload avatar = avatarsByOwnerId.get(user.getId());
                    if (avatar != null) {
                        response.setAvatarUrl(avatar.getFileUrl());
                        response.setAvatarPublicId(avatar.getPublicId());
                    }
                    return response;
                })
                .toList();
    }

    @Override
    public UserDetailResponse getUserById(Long id) {

        User user = userRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        return mapCurrent(user);
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

        return mapCurrent(user);
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

        return mapCurrent(user);
    }
}
