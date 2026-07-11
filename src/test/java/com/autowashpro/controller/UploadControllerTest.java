package com.autowashpro.controller;

import com.autowashpro.config.SecurityConfig;
import com.autowashpro.dto.response.UploadImageResponse;
import com.autowashpro.exception.GlobalExceptionHandler;
import com.autowashpro.security.CustomUserDetailsService;
import com.autowashpro.security.JwtAuthenticationFilter;
import com.autowashpro.security.JwtService;
import com.autowashpro.service.UploadService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = UploadController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class})
@ActiveProfiles("test")
class UploadControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UploadService uploadService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private CustomUserDetailsService customUserDetailsService;

    @Test
    void uploadsInspectionImageWithBookingEntityId() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "inspection.jpg",
                "image/jpeg",
                new byte[]{1, 2, 3});
        UploadImageResponse response = UploadImageResponse.builder()
                .imageUrl("https://images.test/inspection.jpg")
                .publicId("autowashpro/inspections/inspection-1")
                .folder("inspections")
                .build();
        when(uploadService.uploadImage(any(), eq("inspections"), eq(30L), eq(2L), eq("ROLE_STAFF")))
                .thenReturn(response);

        mockMvc.perform(multipart("/uploads/images")
                        .file(file)
                        .param("folder", "inspections")
                        .param("entity_id", "30")
                        .with(user("2").roles("STAFF")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.imageUrl").value(response.getImageUrl()))
                .andExpect(jsonPath("$.data.publicId").value(response.getPublicId()));
    }

    @Test
    void deletesImageUsingSnakeCasePublicId() throws Exception {
        String publicId = "autowashpro/avatars/avatar-1";

        mockMvc.perform(delete("/uploads/images")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"public_id\":\"" + publicId + "\"}")
                        .with(user("1").roles("CUSTOMER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(uploadService).deleteImage(publicId, 1L, "ROLE_CUSTOMER");
    }

    @Test
    void rejectsAnonymousUpload() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.jpg",
                "image/jpeg",
                new byte[]{1, 2, 3});

        mockMvc.perform(multipart("/uploads/images")
                        .file(file)
                        .param("folder", "avatars"))
                .andExpect(status().isForbidden());

        verify(uploadService, never()).uploadImage(any(), any(), any(), any(), any());
    }
}
