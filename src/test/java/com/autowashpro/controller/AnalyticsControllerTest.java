package com.autowashpro.controller;

import com.autowashpro.config.SecurityConfig;
import com.autowashpro.dto.request.AnalyticsFilterRequest;
import com.autowashpro.dto.response.AnalyticsOverviewResponse;
import com.autowashpro.exception.GlobalExceptionHandler;
import com.autowashpro.security.CustomUserDetailsService;
import com.autowashpro.security.JwtAuthenticationFilter;
import com.autowashpro.security.JwtService;
import com.autowashpro.service.AdminDashboardBookingService;
import com.autowashpro.service.AnalyticsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AnalyticsController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class})
@ActiveProfiles("test")
class AnalyticsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AnalyticsService analyticsService;

    @MockitoBean
    private AdminDashboardBookingService adminDashboardBookingService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private CustomUserDetailsService customUserDetailsService;

    @MockitoBean
    private AdminDashboardBookingService adminDashboardBookingService;

    @Test
    void rejectsCustomerAnalyticsAccess() throws Exception {
        mockMvc.perform(get("/admin/analytics/overview")
                        .param("from", "2026-06-01")
                        .param("to", "2026-06-30")
                        .with(user("1").roles("CUSTOMER")))
                .andExpect(status().isForbidden());

        verify(analyticsService, never()).getOverview(any());
    }

    @Test
    void allowsAdminOverviewWithGarageFilter() throws Exception {
        LocalDate from = LocalDate.of(2026, 6, 1);
        LocalDate to = LocalDate.of(2026, 6, 30);
        AnalyticsOverviewResponse response = AnalyticsOverviewResponse.builder()
                .from(from)
                .to(to)
                .garageId(7L)
                .totalBookings(12L)
                .paidBookings(8L)
                .totalRevenue(new BigDecimal("1500000.00"))
                .build();
        when(analyticsService.getOverview(any(AnalyticsFilterRequest.class))).thenReturn(response);

        mockMvc.perform(get("/admin/analytics/overview")
                        .param("from", "2026-06-01")
                        .param("to", "2026-06-30")
                        .param("garage_id", "7")
                        .with(user("3").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.garageId").value(7))
                .andExpect(jsonPath("$.data.totalBookings").value(12))
                .andExpect(jsonPath("$.data.paidBookings").value(8));

        verify(analyticsService).getOverview(argThat(filter ->
                from.equals(filter.getFrom())
                        && to.equals(filter.getTo())
                        && Long.valueOf(7L).equals(filter.getGarageId())));
    }

    @Test
    void returnsBadRequestForInvalidDateRange() throws Exception {
        LocalDate from = LocalDate.of(2026, 7, 10);
        LocalDate to = LocalDate.of(2026, 7, 1);
        when(analyticsService.getRevenueStatistics(any(AnalyticsFilterRequest.class)))
                .thenThrow(new ResponseStatusException(BAD_REQUEST, "from must be before or equal to to"));

        mockMvc.perform(get("/admin/analytics/revenue")
                        .param("from", "2026-07-10")
                        .param("to", "2026-07-01")
                        .with(user("3").roles("ADMIN")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }
}
