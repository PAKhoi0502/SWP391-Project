package com.autowashpro.controller;

import com.autowashpro.config.SecurityConfig;
import com.autowashpro.dto.response.AuditLogResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.exception.GlobalExceptionHandler;
import com.autowashpro.security.CustomUserDetailsService;
import com.autowashpro.security.JwtAuthenticationFilter;
import com.autowashpro.security.JwtService;
import com.autowashpro.service.AuditLogService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AuditLogController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class})
@ActiveProfiles("test")
class AuditLogControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuditLogService auditLogService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private CustomUserDetailsService customUserDetailsService;

    @Test
    void rejectsNonAdminListAccess() throws Exception {
        mockMvc.perform(get("/admin/audit-logs").with(user("2").roles("STAFF")))
                .andExpect(status().isForbidden());

        verify(auditLogService, never()).list(any(Integer.class), any(Integer.class), any(), any(), any(), any(), any());
    }

    @Test
    void allowsAdminToFilterAuditLogs() throws Exception {
        AuditLogResponse item = AuditLogResponse.builder()
                .id(12L)
                .actorId(3L)
                .action("BOOKING_MARK_PAID")
                .targetType("BOOKING")
                .targetId(8L)
                .metadata(Map.of("paymentMethod", "CASH"))
                .createdAt(LocalDateTime.of(2026, 7, 7, 1, 0))
                .build();
        when(auditLogService.list(
                1,
                10,
                3L,
                "BOOKING_MARK_PAID",
                "BOOKING",
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 7, 7)))
                .thenReturn(PageResponse.<AuditLogResponse>builder()
                        .data(List.of(item))
                        .page(1)
                        .limit(10)
                        .totalItems(1L)
                        .totalPages(1)
                        .build());

        mockMvc.perform(get("/admin/audit-logs")
                        .param("actor_id", "3")
                        .param("action", "BOOKING_MARK_PAID")
                        .param("target_type", "BOOKING")
                        .param("from", "2026-07-01")
                        .param("to", "2026-07-07")
                        .with(user("3").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.data[0].action").value("BOOKING_MARK_PAID"));
    }

    @Test
    void allowsAdminToViewDetail() throws Exception {
        when(auditLogService.getById(12L)).thenReturn(AuditLogResponse.builder()
                .id(12L)
                .action("USER_ROLE_UPDATED")
                .targetType("USER")
                .targetId(7L)
                .metadata(Map.of("role", "STAFF"))
                .createdAt(LocalDateTime.of(2026, 7, 7, 1, 0))
                .build());

        mockMvc.perform(get("/admin/audit-logs/12").with(user("3").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(12))
                .andExpect(jsonPath("$.data.metadata.role").value("STAFF"));
    }
}
