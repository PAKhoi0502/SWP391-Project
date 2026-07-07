package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.request.DeleteImageRequest;
import com.autowashpro.dto.response.UploadImageResponse;
import com.autowashpro.service.UploadService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/uploads/images")
@RequiredArgsConstructor
public class UploadController {

    private final UploadService uploadService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('CUSTOMER', 'STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<UploadImageResponse>> uploadImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam("folder") String folder,
            @RequestParam(value = "entity_id", required = false) Long entityId,
            @AuthenticationPrincipal UserDetails userDetails) {

        UploadImageResponse uploaded = uploadService.uploadImage(
                file,
                folder,
                entityId,
                Long.valueOf(userDetails.getUsername()),
                primaryRole(userDetails));

        return ResponseEntity.status(HttpStatus.CREATED).body(
                ApiResponse.<UploadImageResponse>builder()
                        .success(true)
                        .message("Image uploaded successfully")
                        .data(uploaded)
                        .build());
    }

    @DeleteMapping
    @PreAuthorize("hasAnyRole('CUSTOMER', 'STAFF', 'ADMIN')")
    public ApiResponse<Void> deleteImage(
            @Valid @RequestBody DeleteImageRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        uploadService.deleteImage(
                request.getPublicId(),
                Long.valueOf(userDetails.getUsername()),
                primaryRole(userDetails));

        return ApiResponse.<Void>builder()
                .success(true)
                .message("Image deleted successfully")
                .data(null)
                .build();
    }

    private String primaryRole(UserDetails userDetails) {
        return userDetails.getAuthorities().stream()
                .findFirst()
                .map(authority -> authority.getAuthority())
                .orElse("");
    }
}
