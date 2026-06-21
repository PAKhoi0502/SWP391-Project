package com.autowashpro.controller;

import com.autowashpro.dto.request.LoginRequest;
import com.autowashpro.dto.request.RefreshTokenRequest;
import com.autowashpro.dto.request.RegisterRequest;
import com.autowashpro.dto.response.AuthResponse;
import com.autowashpro.dto.response.UserResponse;
import com.autowashpro.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public AuthResponse register(
            @Valid @RequestBody RegisterRequest request) {

        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(
            @Valid @RequestBody LoginRequest request) {

        return authService.login(request);
    }
    @GetMapping("/me")
public UserResponse me(
        Authentication authentication) {

    return UserResponse.builder()
            .id(
                    Long.valueOf(
                            authentication.getName()))
            .build();
}
@PostMapping("/refresh-token")
public AuthResponse refreshToken(
        @RequestBody RefreshTokenRequest request) {

    return authService.refreshToken(
            request.getRefreshToken());
}
@PostMapping("/logout")
public String logout(
        @RequestBody RefreshTokenRequest request) {

    authService.logout(
            request.getRefreshToken());

    return "Logout success";
}
}