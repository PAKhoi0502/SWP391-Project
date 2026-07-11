package com.autowashpro.common;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

public enum ResearchExportFormat {
    CSV("csv", "text/csv;charset=UTF-8"),
    JSON("json", "application/json");

    private final String extension;
    private final String contentType;

    ResearchExportFormat(String extension, String contentType) {
        this.extension = extension;
        this.contentType = contentType;
    }

    public String extension() {
        return extension;
    }

    public String contentType() {
        return contentType;
    }

    public static ResearchExportFormat from(String value) {
        if (value == null || value.isBlank()) {
            return CSV;
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "format must be csv or json");
        }
    }
}
