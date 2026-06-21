package com.autowashpro.service;

import com.autowashpro.dto.request.LoginRequest;
import com.autowashpro.dto.request.RegisterRequest;
import com.autowashpro.dto.response.AuthResponse;

public interface AuthService {

    AuthResponse register(RegisterRequest request);

    AuthResponse login(LoginRequest request);

    AuthResponse refreshToken(String refreshToken);

    void logout(String refreshToken);

    String forgotPassword(String email);

    String resetPassword(
        String token,
        String newPassword);
}