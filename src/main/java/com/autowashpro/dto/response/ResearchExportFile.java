package com.autowashpro.dto.response;

public record ResearchExportFile(
        String filename,
        String contentType,
        byte[] content) {
}
