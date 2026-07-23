package com.autowashpro.controller;

import com.autowashpro.common.AuditAction;
import com.autowashpro.common.AuditTargetType;
import com.autowashpro.dto.response.AuthResponse;
import com.autowashpro.dto.response.GarageCapabilitiesResponse;
import com.autowashpro.dto.response.GarageResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.dto.response.ServicePackageResponse;
import com.autowashpro.dto.response.UserDetailResponse;
import com.autowashpro.dto.response.UserResponse;
import com.autowashpro.dto.response.VehicleResponse;
import com.autowashpro.dto.response.WashBayCapacityResponse;
import com.autowashpro.dto.response.WashBayResponse;
import com.autowashpro.entity.enums.WashBayStatus;
import com.autowashpro.security.JwtAuthenticationFilter;
import com.autowashpro.service.AuthService;
import com.autowashpro.service.AuditLogService;
import com.autowashpro.service.GarageService;
import com.autowashpro.service.ServicePackageService;
import com.autowashpro.service.UserService;
import com.autowashpro.service.VehicleService;
import com.autowashpro.service.WashBayService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {
        AuthController.class,
        UserController.class,
        GarageController.class,
        WashBayController.class,
        VehicleController.class,
        ServicePackageController.class
})
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class CoreModuleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private AuditLogService auditLogService;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private GarageService garageService;

    @MockitoBean
    private WashBayService washBayService;

    @MockitoBean
    private VehicleService vehicleService;

    @MockitoBean
    private ServicePackageService servicePackageService;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @BeforeEach
    void setUp() {
        when(garageService.list(1, 10, null, null)).thenReturn(PageResponse.<GarageResponse>builder()
                .data(List.of())
                .page(1)
                .limit(10)
                .totalItems(0L)
                .totalPages(0)
                .build());
        when(servicePackageService.getAvailable("CAR")).thenReturn(List.of());
    }

    @Test
    void registerBindsValidRequest() throws Exception {
        AuthResponse response = AuthResponse.builder()
                .accessToken("REGISTER_SUCCESS")
                .refreshToken("")
                .user(UserResponse.builder()
                        .id(1L)
                        .fullName("New Customer")
                        .role("CUSTOMER")
                        .build())
                .build();
        when(authService.register(any())).thenReturn(response);

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "New Customer",
                                  "email": "new.customer@test.local",
                                  "phone": "0901999999",
                                  "password": "password123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("CUSTOMER"));

        verify(authService).register(any());
    }

    @Test
    void registerRejectsInvalidRequestBeforeService() throws Exception {
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"invalid\",\"password\":\"123\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        verify(authService, never()).register(any());
    }

    @Test
    void loginBindsCredentials() throws Exception {
        AuthResponse response = AuthResponse.builder()
                .accessToken("access-token")
                .refreshToken("refresh-token")
                .user(UserResponse.builder().id(1L).role("CUSTOMER").build())
                .build();
        when(authService.login(any())).thenReturn(response);

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"0901999999\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("access-token"));

        verify(authService).login(any());
    }

    @Test
    void loginRejectsMissingPasswordBeforeService() throws Exception {
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"0901999999\"}"))
                .andExpect(status().isBadRequest());

        verify(authService, never()).login(any());
    }

    @Test
    void refreshTokenDelegatesToken() throws Exception {
        when(authService.refreshToken("refresh-token")).thenReturn(AuthResponse.builder()
                .accessToken("new-access-token")
                .refreshToken("refresh-token")
                .build());

        mockMvc.perform(post("/auth/refresh-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"refresh-token\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("new-access-token"));
    }

    @Test
    void logoutDelegatesToken() throws Exception {
        mockMvc.perform(post("/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"refresh-token\"}"))
                .andExpect(status().isOk())
                .andExpect(content().string("Logout success"));

        verify(authService).logout("refresh-token");
    }

    @Test
    @WithMockUser(username = "1", roles = "CUSTOMER")
    void authMeUsesAuthenticatedUserId() throws Exception {
        mockMvc.perform(get("/auth/me")
                        .principal(new TestingAuthenticationToken("1", null, "ROLE_CUSTOMER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    @WithMockUser(username = "1", roles = "CUSTOMER")
    void userMeDelegatesAuthenticatedUserId() throws Exception {
        when(userService.getCurrentUser(1L)).thenReturn(UserDetailResponse.builder()
                .id(1L)
                .fullName("Customer Test")
                .role("CUSTOMER")
                .isActive(true)
                .build());

        mockMvc.perform(get("/users/me")
                        .principal(new TestingAuthenticationToken("1", null, "ROLE_CUSTOMER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Customer Test"));

        verify(userService).getCurrentUser(1L);
    }

    @Test
    void userRoleUpdateBindsPathAndBody() throws Exception {
        when(userService.updateRole(eq(9L), any())).thenReturn(UserDetailResponse.builder()
                .id(9L)
                .role("STAFF")
                .isActive(true)
                .build());

        mockMvc.perform(patch("/users/9/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"STAFF\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("STAFF"));

        verify(auditLogService).createAuditLog(
                isNull(),
                eq(AuditAction.USER_ROLE_UPDATED),
                eq(AuditTargetType.USER),
                eq(9L),
                any());
    }

    @Test
    void garageCreateValidatesAndReturnsGarage() throws Exception {
        when(garageService.create(any())).thenReturn(GarageResponse.builder()
                .id(1L)
                .garageCode("TEST-GARAGE")
                .isActive(true)
                .build());

        mockMvc.perform(post("/api/garages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Test Garage",
                                  "garageCode": "TEST-GARAGE",
                                  "address": "100 Test Street",
                                  "city": "Ho Chi Minh City",
                                  "phone": "0287000001",
                                  "openingTime": "07:00:00",
                                  "closingTime": "21:00:00",
                                  "slotIntervalMinutes": 30
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.garageCode").value("TEST-GARAGE"));
    }

    @Test
    void garageCreateRejectsMissingRequiredFields() throws Exception {
        mockMvc.perform(post("/api/garages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        verify(garageService, never()).create(any());
    }

    @Test
    void garageListBindsPagingAndFilters() throws Exception {
        when(garageService.list(2, 5, true, "district"))
                .thenReturn(PageResponse.<GarageResponse>builder()
                        .data(List.of())
                        .page(2)
                        .limit(5)
                        .totalItems(0L)
                        .totalPages(0)
                        .build());

        mockMvc.perform(get("/api/garages")
                        .param("page", "2")
                        .param("limit", "5")
                        .param("isActive", "true")
                        .param("keyword", "district"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(2));

        verify(garageService).list(2, 5, true, "district");
    }

    @Test
    void garageCapabilitiesUsesPathId() throws Exception {
        when(garageService.getCapabilities(1L)).thenReturn(GarageCapabilitiesResponse.builder()
                .garageId(1L)
                .supportedVehicleTypes(List.of("CAR", "BIKE"))
                .build());

        mockMvc.perform(get("/api/garages/1/capabilities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.supportedVehicleTypes.length()").value(2));
    }

    @Test
    void washBayCreateValidatesAndReturnsBay() throws Exception {
        when(washBayService.create(any())).thenReturn(WashBayResponse.builder()
                .id(1L)
                .garageId(1L)
                .bayCode("CAR-01")
                .vehicleType("CAR")
                .status(WashBayStatus.AVAILABLE)
                .isActive(true)
                .build());

        mockMvc.perform(post("/api/wash-bays")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"garageId\":1,\"name\":\"CAR-01\",\"vehicleType\":\"CAR\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AVAILABLE"));
    }

    @Test
    void washBayCreateRejectsInvalidBody() throws Exception {
        mockMvc.perform(post("/api/wash-bays")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        verify(washBayService, never()).create(any());
    }

    @Test
    @WithMockUser(username = "1", roles = "ADMIN")
    void washBayCapacityBindsVehicleTypeFilter() throws Exception {
        when(washBayService.getCapacity(eq(1L), eq("CAR"), anyLong(), anyString()))
                .thenReturn(WashBayCapacityResponse.builder()
                        .garageId(1L)
                        .availableCountByVehicleType(Map.of("CAR", 3L))
                        .build());

        mockMvc.perform(get("/api/wash-bays/garages/1/capacity")
                        .param("vehicleType", "CAR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.availableCountByVehicleType.CAR").value(3));
    }

    @Test
    @WithMockUser(username = "1", roles = "CUSTOMER")
    void vehicleCreateUsesAuthenticatedCustomer() throws Exception {
        when(vehicleService.create(any(), eq(1L))).thenReturn(VehicleResponse.builder()
                .id(1L)
                .customerId(1L)
                .normalizedLicensePlate("51H12345")
                .isDefault(true)
                .isActive(true)
                .build());

        mockMvc.perform(post("/api/vehicles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "rawLicensePlate": "51H-123.45",
                                  "vehicleType": "CAR",
                                  "brand": "Toyota",
                                  "model": "Vios"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerId").value(1));

        verify(vehicleService).create(any(), eq(1L));
    }

    @Test
    @WithMockUser(username = "1", roles = "CUSTOMER")
    void vehicleCreateRejectsMissingRequiredFields() throws Exception {
        mockMvc.perform(post("/api/vehicles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        verify(vehicleService, never()).create(any(), eq(1L));
    }

    @Test
    @WithMockUser(username = "1", roles = "CUSTOMER")
    void vehicleSetDefaultUsesPathAndCustomerId() throws Exception {
        when(vehicleService.setDefault(7L, 1L)).thenReturn(VehicleResponse.builder()
                .id(7L)
                .customerId(1L)
                .isDefault(true)
                .isActive(true)
                .build());

        mockMvc.perform(patch("/api/vehicles/7/default"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isDefault").value(true));

        verify(vehicleService).setDefault(7L, 1L);
    }

    @Test
    void servicePackageCreateBindsRequest() throws Exception {
        when(servicePackageService.create(any())).thenReturn(ServicePackageResponse.builder()
                .id(1L)
                .code("CAR-BASIC")
                .serviceType("MAIN")
                .build());

        mockMvc.perform(post("/service-packages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Car Basic Wash",
                                  "code": "CAR-BASIC",
                                  "vehicleType": "CAR",
                                  "serviceType": "MAIN",
                                  "basePrice": 120000,
                                  "durationMinutes": 45
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serviceType").value("MAIN"));
    }

    @Test
    void servicePackageAvailableBindsVehicleType() throws Exception {
        mockMvc.perform(get("/service-packages/available").param("vehicleType", "CAR"))
                .andExpect(status().isOk());

        verify(servicePackageService).getAvailable("CAR");
    }

    @Test
    void servicePackageStatusBindsPathAndBody() throws Exception {
        when(servicePackageService.updateStatus(eq(1L), any())).thenReturn(ServicePackageResponse.builder()
                .id(1L)
                .isActive(false)
                .build());

        mockMvc.perform(patch("/service-packages/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isActive\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isActive").value(false));
    }
}
