package com.autowashpro.service.impl;

import com.autowashpro.config.CloudinaryProperties;
import com.autowashpro.service.ImageStorageProvider;
import com.autowashpro.service.support.StoredImage;
import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class CloudinaryImageStorageProvider implements ImageStorageProvider {

    private final Cloudinary cloudinary;
    private final CloudinaryProperties properties;

    @Override
    public StoredImage upload(byte[] content, String folder) {
        requireConfigured();

        try {
            Map<?, ?> result = cloudinary.uploader().upload(
                    content,
                    ObjectUtils.asMap(
                            "resource_type", "image",
                            "folder", folder,
                            "use_filename", false,
                            "unique_filename", true,
                            "overwrite", false));

            String imageUrl = value(result, "secure_url");
            String publicId = value(result, "public_id");

            if (imageUrl == null || publicId == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Image storage returned an invalid response");
            }

            return new StoredImage(imageUrl, publicId);
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (IOException | RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Image storage upload failed");
        }
    }

    @Override
    public void delete(String publicId) {
        requireConfigured();

        try {
            Map<?, ?> result = cloudinary.uploader().destroy(
                    publicId,
                    ObjectUtils.asMap(
                            "resource_type", "image",
                            "invalidate", true));

            String status = value(result, "result");
            if (!"ok".equalsIgnoreCase(status) && !"not found".equalsIgnoreCase(status)) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Image storage delete failed");
            }
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (IOException | RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Image storage delete failed");
        }
    }

    private void requireConfigured() {
        if (!properties.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Image storage is not configured");
        }
    }

    private String value(Map<?, ?> values, String key) {
        Object value = values.get(key);
        return value == null ? null : value.toString();
    }
}
