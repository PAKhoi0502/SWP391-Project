package com.autowashpro.service.impl;

import com.autowashpro.dto.request.LoginRequest;
import com.autowashpro.dto.request.RegisterRequest;
import com.autowashpro.dto.response.AuthResponse;
import com.autowashpro.entity.PasswordReset;
import com.autowashpro.entity.RefreshToken;
import com.autowashpro.entity.User;
import com.autowashpro.repository.PasswordResetRepository;
import com.autowashpro.repository.RefreshTokenRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.security.JwtService;
import com.autowashpro.service.EmailService;
import com.autowashpro.support.TestFixtures;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private PasswordResetRepository passwordResetRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private AuthServiceImpl authService;

    @Test
    void registerCreatesActiveCustomerWithEncodedPassword() {
        RegisterRequest request = TestFixtures.registerRequest();
        when(passwordEncoder.encode(request.getPassword())).thenReturn("encoded-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(10L);
            return user;
        });

        AuthResponse response = authService.register(request);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User saved = captor.getValue();
        assertEquals("CUSTOMER", saved.getRole());
        assertEquals("+84901999999", saved.getPhone());
        assertEquals("encoded-password", saved.getPasswordHash());
        assertTrue(saved.getIsActive());
        assertEquals(10L, response.getUser().getId());
        verify(emailService).sendWelcomeEmail(request.getEmail(), request.getFullName());
    }

    @Test
    void registerRejectsDuplicateEmail() {
        RegisterRequest request = TestFixtures.registerRequest();
        when(userRepository.existsByEmail(request.getEmail())).thenReturn(true);

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> authService.register(request));

        assertEquals("Email already exists", error.getMessage());
        verify(userRepository, never()).save(any());
    }

    @Test
    void registerRejectsDuplicatePhone() {
        RegisterRequest request = TestFixtures.registerRequest();
        when(userRepository.existsByPhone("+84901999999")).thenReturn(true);

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> authService.register(request));

        assertEquals("Phone already exists", error.getMessage());
        verify(userRepository, never()).save(any());
    }

    @Test
    void loginReturnsTokensAndPersistsRefreshToken() {
        User customer = TestFixtures.customer();
        LoginRequest request = new LoginRequest("0901 000 001", "password123");
        when(userRepository.findByPhone(customer.getPhone())).thenReturn(Optional.of(customer));
        when(passwordEncoder.matches(request.getPassword(), customer.getPasswordHash())).thenReturn(true);
        when(jwtService.generateToken(customer.getId(), customer.getRole())).thenReturn("access-token");
        when(jwtService.generateRefreshToken(customer.getId())).thenReturn("refresh-token");

        AuthResponse response = authService.login(request);

        assertEquals("access-token", response.getAccessToken());
        assertEquals("refresh-token", response.getRefreshToken());
        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(captor.capture());
        assertEquals(customer, captor.getValue().getUser());
        assertFalse(captor.getValue().getIsRevoked());
    }

    @Test
    void loginRejectsUnknownPhone() {
        LoginRequest request = new LoginRequest("0900000000", "password123");
        when(userRepository.findByPhone("+84900000000")).thenReturn(Optional.empty());

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> authService.login(request));

        assertEquals("Invalid credentials", error.getMessage());
    }

    @Test
    void loginRejectsInactiveUser() {
        User customer = TestFixtures.customer();
        customer.setIsActive(false);
        LoginRequest request = new LoginRequest(customer.getPhone(), "password123");
        when(userRepository.findByPhone(customer.getPhone())).thenReturn(Optional.of(customer));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> authService.login(request));

        assertEquals("User is inactive", error.getMessage());
        verify(passwordEncoder, never()).matches(any(), any());
    }

    @Test
    void loginRejectsWrongPassword() {
        User customer = TestFixtures.customer();
        LoginRequest request = new LoginRequest(customer.getPhone(), "wrong-password");
        when(userRepository.findByPhone(customer.getPhone())).thenReturn(Optional.of(customer));
        when(passwordEncoder.matches(request.getPassword(), customer.getPasswordHash())).thenReturn(false);

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> authService.login(request));

        assertEquals("Invalid credentials", error.getMessage());
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void refreshTokenRejectsRevokedToken() {
        RefreshToken refreshToken = RefreshToken.builder()
                .user(TestFixtures.customer())
                .token("refresh-token")
                .isRevoked(true)
                .expiresAt(LocalDateTime.now().plusDays(1))
                .build();
        when(refreshTokenRepository.findByToken("refresh-token")).thenReturn(Optional.of(refreshToken));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> authService.refreshToken("refresh-token"));

        assertEquals("Refresh token revoked", error.getMessage());
    }

    @Test
    void logoutRevokesRefreshToken() {
        RefreshToken refreshToken = RefreshToken.builder()
                .user(TestFixtures.customer())
                .token("refresh-token")
                .isRevoked(false)
                .build();
        when(refreshTokenRepository.findByToken("refresh-token")).thenReturn(Optional.of(refreshToken));

        authService.logout("refresh-token");

        assertTrue(refreshToken.getIsRevoked());
        verify(refreshTokenRepository).save(refreshToken);
    }

    @Test
    void resetPasswordUpdatesPasswordAndRevokesRefreshTokens() {
        User customer = TestFixtures.customer();
        PasswordReset passwordReset = PasswordReset.builder()
                .user(customer)
                .token("hashed-reset-token")
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .isUsed(false)
                .build();
        RefreshToken refreshToken = RefreshToken.builder()
                .user(customer)
                .token("refresh-token")
                .isRevoked(false)
                .build();
        when(passwordResetRepository.findAll()).thenReturn(List.of(passwordReset));
        when(passwordEncoder.matches("raw-reset-token", "hashed-reset-token")).thenReturn(true);
        when(passwordEncoder.encode("new-password")).thenReturn("new-encoded-password");
        when(refreshTokenRepository.findAllByUser_Id(customer.getId())).thenReturn(List.of(refreshToken));

        String result = authService.resetPassword("raw-reset-token", "new-password");

        assertEquals("Password reset success", result);
        assertEquals("new-encoded-password", customer.getPasswordHash());
        assertTrue(passwordReset.getIsUsed());
        assertTrue(refreshToken.getIsRevoked());
        verify(userRepository).save(customer);
        verify(refreshTokenRepository).saveAll(List.of(refreshToken));
    }
}
