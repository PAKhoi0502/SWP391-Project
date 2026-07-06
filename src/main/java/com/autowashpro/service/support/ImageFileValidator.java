package com.autowashpro.service.support;

import com.autowashpro.config.UploadProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Arrays;

@Component
@RequiredArgsConstructor
public class ImageFileValidator {

    private static final byte[] PNG_SIGNATURE = {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    };

    private final UploadProperties properties;

    public ValidatedImage validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "file must not be empty");
        }

        if (file.getSize() > properties.getMaxImageSizeBytes()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "image exceeds configured size limit");
        }

        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cannot read uploaded file");
        }

        String mimeType = detectMimeType(content);
        if (mimeType == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "file must be a JPEG, PNG or WEBP image");
        }

        return new ValidatedImage(content, mimeType);
    }

    private String detectMimeType(byte[] content) {
        if (content.length >= 3
                && unsigned(content[0]) == 0xFF
                && unsigned(content[1]) == 0xD8
                && unsigned(content[2]) == 0xFF) {
            return "image/jpeg";
        }

        if (content.length >= PNG_SIGNATURE.length
                && Arrays.equals(Arrays.copyOf(content, PNG_SIGNATURE.length), PNG_SIGNATURE)) {
            return "image/png";
        }

        if (content.length >= 12
                && matchesAscii(content, 0, "RIFF")
                && matchesAscii(content, 8, "WEBP")) {
            return "image/webp";
        }

        return null;
    }

    private boolean matchesAscii(byte[] content, int offset, String value) {
        for (int index = 0; index < value.length(); index++) {
            if (content[offset + index] != (byte) value.charAt(index)) {
                return false;
            }
        }
        return true;
    }

    private int unsigned(byte value) {
        return value & 0xFF;
    }
}
