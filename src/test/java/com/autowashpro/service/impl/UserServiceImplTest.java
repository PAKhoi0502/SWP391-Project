package com.autowashpro.service.impl;

import com.autowashpro.dto.request.UpdateProfileRequest;
import com.autowashpro.dto.request.UpdateUserRoleRequest;
import com.autowashpro.dto.request.UpdateUserStatusRequest;
import com.autowashpro.dto.response.UserDetailResponse;
import com.autowashpro.entity.Upload;
import com.autowashpro.entity.User;
import com.autowashpro.repository.UploadRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.support.TestFixtures;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UploadRepository uploadRepository;

    @InjectMocks
    private UserServiceImpl userService;

    @Test
    void getCurrentUserMapsUserDetails() {
        User customer = TestFixtures.customer();
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));

        UserDetailResponse response = userService.getCurrentUser(customer.getId());

        assertEquals(customer.getEmail(), response.getEmail());
        assertEquals("CUSTOMER", response.getRole());
    }

    @Test
    void getCurrentUserIncludesCurrentAvatar() {
        User customer = TestFixtures.customer();
        Upload avatar = new Upload();
        avatar.setFileUrl("https://images.test/avatar.jpg");
        avatar.setPublicId("autowashpro/avatars/avatar-1");
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(uploadRepository.findFirstByOwnerIdAndEntityTypeAndEntityIdOrderByCreatedAtDesc(
                customer.getId(), "AVATAR", customer.getId()))
                .thenReturn(Optional.of(avatar));

        UserDetailResponse response = userService.getCurrentUser(customer.getId());

        assertEquals(avatar.getFileUrl(), response.getAvatarUrl());
        assertEquals(avatar.getPublicId(), response.getAvatarPublicId());
    }

    @Test
    void updateCurrentUserChangesProfile() {
        User customer = TestFixtures.customer();
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setFullName("Updated Customer");
        request.setEmail("updated@test.local");
        request.setPhone("0901888888");
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));

        UserDetailResponse response = userService.updateCurrentUser(customer.getId(), request);

        assertEquals("Updated Customer", response.getFullName());
        assertEquals("updated@test.local", customer.getEmail());
        verify(userRepository).save(customer);
    }

    @Test
    void updateCurrentUserRejectsDuplicateEmail() {
        User customer = TestFixtures.customer();
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setFullName(customer.getFullName());
        request.setEmail("duplicate@test.local");
        request.setPhone(customer.getPhone());
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(userRepository.existsByEmail(request.getEmail())).thenReturn(true);

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.updateCurrentUser(customer.getId(), request));

        assertEquals("Email already exists", error.getMessage());
        verify(userRepository, never()).save(customer);
    }

    @Test
    void updateCurrentUserRejectsDuplicatePhone() {
        User customer = TestFixtures.customer();
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setFullName(customer.getFullName());
        request.setEmail(customer.getEmail());
        request.setPhone("0901777777");
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(userRepository.existsByPhone(request.getPhone())).thenReturn(true);

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.updateCurrentUser(customer.getId(), request));

        assertEquals("Phone already exists", error.getMessage());
    }

    @Test
    void updateRoleAcceptsSupportedRole() {
        User customer = TestFixtures.customer();
        UpdateUserRoleRequest request = new UpdateUserRoleRequest("STAFF");
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));

        UserDetailResponse response = userService.updateRole(customer.getId(), request);

        assertEquals("STAFF", response.getRole());
        verify(userRepository).save(customer);
    }

    @Test
    void updateRoleRejectsUnsupportedRole() {
        UpdateUserRoleRequest request = new UpdateUserRoleRequest("OWNER");

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> userService.updateRole(1L, request));

        assertEquals("Invalid role", error.getMessage());
        verify(userRepository, never()).findById(1L);
    }

    @Test
    void updateStatusDeactivatesUser() {
        User customer = TestFixtures.customer();
        UpdateUserStatusRequest request = new UpdateUserStatusRequest();
        request.setIsActive(false);
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));

        UserDetailResponse response = userService.updateStatus(customer.getId(), request);

        assertFalse(response.getIsActive());
        verify(userRepository).save(customer);
    }

    @Test
    void getAllUsersMapsEveryUser() {
        when(userRepository.findAll()).thenReturn(List.of(TestFixtures.customer(), TestFixtures.admin()));

        List<UserDetailResponse> users = userService.getAllUsers();

        assertEquals(2, users.size());
        assertEquals("ADMIN", users.get(1).getRole());
    }
}
