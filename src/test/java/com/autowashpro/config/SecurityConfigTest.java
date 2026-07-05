package com.autowashpro.config;

import com.autowashpro.controller.AuthController;
import com.autowashpro.controller.HealthController;
import com.autowashpro.controller.ServicePackageController;
import com.autowashpro.controller.UserController;
import com.autowashpro.dto.response.ServicePackageResponse;
import com.autowashpro.dto.response.UserDetailResponse;
import com.autowashpro.security.CustomUserDetailsService;
import com.autowashpro.security.JwtAuthenticationFilter;
import com.autowashpro.security.JwtService;
import com.autowashpro.service.AuthService;
import com.autowashpro.service.ServicePackageService;
import com.autowashpro.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {
        AuthController.class,
        HealthController.class,
        ServicePackageController.class,
        UserController.class
})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
@ActiveProfiles("test")
class SecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private ServicePackageService servicePackageService;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private CustomUserDetailsService customUserDetailsService;

    @BeforeEach
    void setUp() {
        when(servicePackageService.getAll()).thenReturn(List.of());
        when(userService.getAllUsers()).thenReturn(List.of());
    }

    @Test
    void allowsAnonymousHealthCheck() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("UP"));
    }

    @Test
    void allowsAnonymousServicePackageList() throws Exception {
        mockMvc.perform(get("/service-packages"))
                .andExpect(status().isOk());
    }

    @Test
    void rejectsAnonymousUserList() throws Exception {
        mockMvc.perform(get("/users"))
                .andExpect(status().isForbidden());
    }

    @Test
    void rejectsCustomerUserList() throws Exception {
        mockMvc.perform(get("/users").with(user("1").roles("CUSTOMER")))
                .andExpect(status().isForbidden());
    }

    @Test
    void allowsAdminUserList() throws Exception {
        mockMvc.perform(get("/users").with(user("3").roles("ADMIN")))
                .andExpect(status().isOk());

        verify(userService).getAllUsers();
    }

    @Test
    void allowsCustomerToReadOwnProfile() throws Exception {
        UserDetailResponse response = UserDetailResponse.builder()
                .id(1L)
                .fullName("Customer Test")
                .role("CUSTOMER")
                .isActive(true)
                .build();
        when(userService.getCurrentUser(1L)).thenReturn(response);

        mockMvc.perform(get("/users/me").with(user("1").roles("CUSTOMER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));

        verify(userService).getCurrentUser(1L);
    }

    @Test
    void rejectsCustomerRoleUpdate() throws Exception {
        mockMvc.perform(patch("/users/9/role")
                        .with(user("1").roles("CUSTOMER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"ADMIN\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void allowsAdminRoleUpdate() throws Exception {
        UserDetailResponse response = UserDetailResponse.builder()
                .id(9L)
                .role("STAFF")
                .isActive(true)
                .build();
        when(userService.updateRole(eq(9L), any())).thenReturn(response);

        mockMvc.perform(patch("/users/9/role")
                        .with(user("3").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"STAFF\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("STAFF"));
    }

    @Test
    void rejectsCustomerServicePackageCreate() throws Exception {
        mockMvc.perform(post("/service-packages")
                        .with(user("1").roles("CUSTOMER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void allowsAdminServicePackageCreate() throws Exception {
        ServicePackageResponse response = ServicePackageResponse.builder()
                .id(1L)
                .code("CAR-BASIC")
                .name("Car Basic Wash")
                .build();
        when(servicePackageService.create(any())).thenReturn(response);

        mockMvc.perform(post("/service-packages")
                        .with(user("3").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("CAR-BASIC"));
    }
}
