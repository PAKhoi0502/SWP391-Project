package com.autowashpro.service.impl;

import com.autowashpro.dto.request.LoginRequest;
import com.autowashpro.dto.request.RegisterRequest;
import com.autowashpro.dto.response.AuthResponse;
import com.autowashpro.dto.response.UserResponse;
import com.autowashpro.entity.RefreshToken;
import com.autowashpro.entity.User;
import com.autowashpro.repository.RefreshTokenRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.security.JwtService;
import com.autowashpro.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.autowashpro.entity.PasswordReset;
import com.autowashpro.repository.PasswordResetRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetRepository passwordResetRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Override
    public AuthResponse register(RegisterRequest request) {

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already exists");
        }

        if (userRepository.existsByPhone(request.getPhone())) {
            throw new RuntimeException("Phone already exists");
        }

        User user = User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role("CUSTOMER")
                .isActive(true)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        User savedUser = userRepository.save(user);

        return AuthResponse.builder()
                .accessToken("REGISTER_SUCCESS")
                .refreshToken("")
                .user(
                        UserResponse.builder()
                                .id(savedUser.getId())
                                .fullName(savedUser.getFullName())
                                .email(savedUser.getEmail())
                                .phone(savedUser.getPhone())
                                .role(savedUser.getRole())
                                .build()
                )
                .build();
    }

    @Override
    public AuthResponse login(LoginRequest request) {

        User user = userRepository.findByPhone(request.getPhone())
                .orElseThrow(() ->
                        new RuntimeException("Invalid credentials"));

        if (!user.getIsActive()) {
            throw new RuntimeException("User is inactive");
        }

        boolean matches = passwordEncoder.matches(
                request.getPassword(),
                user.getPasswordHash());

        if (!matches) {
            throw new RuntimeException("Invalid credentials");
        }

        String accessToken =
                jwtService.generateToken(
                        user.getId(),
                        user.getRole());

        String refreshTokenValue =
                jwtService.generateRefreshToken(
                        user.getId());

        RefreshToken refreshToken =
                RefreshToken.builder()
                        .user(user)
                        .token(refreshTokenValue)
                        .isRevoked(false)
                        .expiresAt(
                                LocalDateTime.now().plusDays(30))
                        .createdAt(LocalDateTime.now())
                        .build();

        refreshTokenRepository.save(refreshToken);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenValue)
                .user(
                        UserResponse.builder()
                                .id(user.getId())
                                .fullName(user.getFullName())
                                .email(user.getEmail())
                                .phone(user.getPhone())
                                .role(user.getRole())
                                .build()
                )
                .build();
    }

    @Override
    public AuthResponse refreshToken(String token) {

        RefreshToken refreshToken =
                refreshTokenRepository
                        .findByToken(token)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Invalid refresh token"));

        if (refreshToken.getIsRevoked()) {
            throw new RuntimeException(
                    "Refresh token revoked");
        }

        User user = refreshToken.getUser();

        String accessToken =
                jwtService.generateToken(
                        user.getId(),
                        user.getRole());

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(token)
                .user(
                        UserResponse.builder()
                                .id(user.getId())
                                .fullName(user.getFullName())
                                .email(user.getEmail())
                                .phone(user.getPhone())
                                .role(user.getRole())
                                .build()
                )
                .build();
    }

    @Override
    public void logout(String token) {

        RefreshToken refreshToken =
                refreshTokenRepository
                        .findByToken(token)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Token not found"));

        refreshToken.setIsRevoked(true);

        refreshTokenRepository.save(refreshToken);
    }
    @Override
public String forgotPassword(String email) {

    User user = userRepository.findByEmail(email)
            .orElseThrow(() ->
                    new RuntimeException("User not found"));

    String rawToken =
            UUID.randomUUID().toString();

    String hashedToken =
            passwordEncoder.encode(rawToken);

    PasswordReset passwordReset =
            PasswordReset.builder()
                    .user(user)
                    .token(hashedToken)
                    .expiresAt(
                            LocalDateTime.now()
                                    .plusMinutes(15)
                    )
                    .isUsed(false)
                    .createdAt(
                            LocalDateTime.now()
                    )
                    .build();

    passwordResetRepository.save(passwordReset);

    return rawToken;
}
@Override
public String resetPassword(
        String token,
        String newPassword) {

    List<PasswordReset> resets =
            passwordResetRepository.findAll();

    PasswordReset matchedReset = null;

    for (PasswordReset reset : resets) {

        boolean matched =
                passwordEncoder.matches(
                        token,
                        reset.getToken());

        if (matched) {
            matchedReset = reset;
            break;
        }
    }

    if (matchedReset == null) {
        throw new RuntimeException(
                "Invalid reset token");
    }

    if (matchedReset.getIsUsed()) {
        throw new RuntimeException(
                "Token already used");
    }

    if (matchedReset.getExpiresAt()
            .isBefore(LocalDateTime.now())) {

        throw new RuntimeException(
                "Token expired");
    }

    User user =
            matchedReset.getUser();

    user.setPasswordHash(
            passwordEncoder.encode(
                    newPassword));

    userRepository.save(user);

    matchedReset.setIsUsed(true);

    passwordResetRepository.save(
            matchedReset);

    List<RefreshToken> refreshTokens =
            refreshTokenRepository
                    .findAllByUser_Id(
                            user.getId());

    refreshTokens.forEach(tokenItem ->
            tokenItem.setIsRevoked(true));

    refreshTokenRepository.saveAll(
            refreshTokens);

    return "Password reset success";
}
}