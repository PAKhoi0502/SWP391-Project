package com.autowashpro.common;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;

public enum UploadFolder {
    AVATARS("avatars", "AVATAR", "autowashpro/avatars"),
    INSPECTIONS("inspections", "INSPECTION", "autowashpro/inspections"),
    VEHICLES("vehicles", "VEHICLE", "autowashpro/vehicles"),
    REPORTS("reports", "REPORT", "autowashpro/reports"),
    REVIEWS("reviews", "REVIEW", "autowashpro/reviews");

    private final String value;
    private final String entityType;
    private final String storageFolder;

    UploadFolder(String value, String entityType, String storageFolder) {
        this.value = value;
        this.entityType = entityType;
        this.storageFolder = storageFolder;
    }

    public String getValue() {
        return value;
    }

    public String getEntityType() {
        return entityType;
    }

    public String getStorageFolder() {
        return storageFolder;
    }

    public static UploadFolder fromValue(String value) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "folder is required");
        }

        return Arrays.stream(values())
                .filter(folder -> folder.value.equalsIgnoreCase(value.trim()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "folder must be avatars, inspections, vehicles, reports, or reviews"));
    }
}
