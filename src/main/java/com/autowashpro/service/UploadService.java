package com.autowashpro.service;

import com.autowashpro.dto.response.UploadImageResponse;
import com.autowashpro.entity.Upload;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface UploadService {
    UploadImageResponse uploadImage(
            MultipartFile file,
            String folder,
            Long entityId,
            Long currentUserId,
            String role);

    void deleteImage(String publicId, Long currentUserId, String role);

    List<Upload> requireInspectionUploads(
            Long bookingId,
            List<String> publicIds,
            Long currentInspectionId);
}
