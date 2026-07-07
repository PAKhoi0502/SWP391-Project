package com.autowashpro.service.support;

import com.autowashpro.config.UploadProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ImageFileValidatorTest {

    private UploadProperties properties;
    private ImageFileValidator validator;

    @BeforeEach
    void setUp() {
        properties = new UploadProperties();
        properties.setMaxImageSizeBytes(100);
        validator = new ImageFileValidator(properties);
    }

    @Test
    void acceptsJpegSignatureEvenWhenDeclaredTypeIsIncorrect() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.bin",
                "application/octet-stream",
                new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x00});

        ValidatedImage image = validator.validate(file);

        assertEquals("image/jpeg", image.mimeType());
    }

    @Test
    void acceptsPngAndWebpSignatures() {
        byte[] png = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
        byte[] webp = {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'};

        assertEquals("image/png", validator.validate(
                new MockMultipartFile("file", "a.png", "image/png", png)).mimeType());
        assertEquals("image/webp", validator.validate(
                new MockMultipartFile("file", "a.webp", "image/webp", webp)).mimeType());
    }

    @Test
    void rejectsFakeImageAndOversizedFile() {
        MockMultipartFile fake = new MockMultipartFile(
                "file", "fake.jpg", "image/jpeg", "not-an-image".getBytes());
        MockMultipartFile oversized = new MockMultipartFile(
                "file", "large.jpg", "image/jpeg", new byte[101]);

        assertThrows(ResponseStatusException.class, () -> validator.validate(fake));
        assertThrows(ResponseStatusException.class, () -> validator.validate(oversized));
    }

    @Test
    void rejectsEmptyFile() {
        MockMultipartFile empty = new MockMultipartFile("file", new byte[0]);

        assertThrows(ResponseStatusException.class, () -> validator.validate(empty));
    }
}
