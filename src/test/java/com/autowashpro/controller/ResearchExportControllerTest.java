package com.autowashpro.controller;

import com.autowashpro.config.SecurityConfig;
import com.autowashpro.dto.request.ResearchExportFilterRequest;
import com.autowashpro.dto.response.ResearchExportFile;
import com.autowashpro.exception.GlobalExceptionHandler;
import com.autowashpro.security.CustomUserDetailsService;
import com.autowashpro.security.JwtAuthenticationFilter;
import com.autowashpro.security.JwtService;
import com.autowashpro.service.ResearchExportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpHeaders.CACHE_CONTROL;
import static org.springframework.http.HttpHeaders.CONTENT_DISPOSITION;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ResearchExportController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class})
@ActiveProfiles("test")
class ResearchExportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ResearchExportService researchExportService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private CustomUserDetailsService customUserDetailsService;

    @Test
    void rejectsNonAdminExport() throws Exception {
        mockMvc.perform(get("/admin/research/bookings/export")
                        .param("from", "2026-06-01")
                        .param("to", "2026-06-30")
                        .with(user("1").roles("CUSTOMER")))
                .andExpect(status().isForbidden());

        verify(researchExportService, never()).exportBookings(any());
    }

    @Test
    void returnsCsvDownloadForAdmin() throws Exception {
        byte[] content = "customer_anonymous_id\r\ncustomer_abc\r\n".getBytes(StandardCharsets.UTF_8);
        when(researchExportService.exportBookings(any(ResearchExportFilterRequest.class)))
                .thenReturn(new ResearchExportFile(
                        "research-bookings-2026-06-01-to-2026-06-30.csv",
                        "text/csv;charset=UTF-8",
                        content));

        mockMvc.perform(get("/admin/research/bookings/export")
                        .param("from", "2026-06-01")
                        .param("to", "2026-06-30")
                        .param("format", "csv")
                        .with(user("3").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(content().bytes(content))
                .andExpect(header().string(CONTENT_DISPOSITION, containsString("research-bookings")))
                .andExpect(header().string(CACHE_CONTROL, containsString("no-store")));

        verify(researchExportService).exportBookings(argThat(filter ->
                LocalDate.of(2026, 6, 1).equals(filter.getFrom())
                        && LocalDate.of(2026, 6, 30).equals(filter.getTo())
                        && "csv".equals(filter.getFormat())));
    }

    @Test
    void returnsJsonCustomerDownloadForAdmin() throws Exception {
        byte[] content = "[]".getBytes(StandardCharsets.UTF_8);
        when(researchExportService.exportCustomers(any(ResearchExportFilterRequest.class)))
                .thenReturn(new ResearchExportFile(
                        "research-customers-2026-06-01-to-2026-06-30.json",
                        "application/json",
                        content));

        mockMvc.perform(get("/admin/research/customers/export")
                        .param("from", "2026-06-01")
                        .param("to", "2026-06-30")
                        .param("format", "json")
                        .with(user("3").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(content().bytes(content));
    }

    @Test
    void preservesBadRequestFromExportValidation() throws Exception {
        when(researchExportService.exportBookings(any(ResearchExportFilterRequest.class)))
                .thenThrow(new ResponseStatusException(BAD_REQUEST, "format must be csv or json"));

        mockMvc.perform(get("/admin/research/bookings/export")
                        .param("from", "2026-06-01")
                        .param("to", "2026-06-30")
                        .param("format", "xml")
                        .with(user("3").roles("ADMIN")))
                .andExpect(status().isBadRequest());
    }
}
