package com.autowashpro.service.support;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.regex.Pattern;

public final class VietnameseLicensePlate {

    private static final Pattern ALLOWED_INPUT = Pattern.compile("^[A-Za-z0-9\\s.\\-]+$");
    private static final Pattern CURRENT_CAR = Pattern.compile("^\\d{2}[A-Z]\\d{5}$");
    private static final Pattern CURRENT_BIKE = Pattern.compile("^\\d{2}[A-Z][A-Z0-9]\\d{5}$");
    private static final Pattern LEGACY_BIKE_SHORT = Pattern.compile("^\\d{2}[A-Z]\\d{4}$");
    private static final Pattern LEGACY_BIKE_LONG = Pattern.compile("^\\d{2}[A-Z][A-Z0-9]\\d{4}$");

    private VietnameseLicensePlate() {
    }

    public static String normalizeAndValidate(String input, String vehicleType) {
        String normalizedType = normalizeVehicleType(vehicleType);
        if (input == null || input.isBlank()) {
            throw invalid("License plate is required");
        }

        String trimmed = input.trim();
        if (!ALLOWED_INPUT.matcher(trimmed).matches()) {
            throw invalid("License plate contains unsupported characters");
        }

        String normalized = trimmed.toUpperCase(Locale.ROOT).replaceAll("[\\s.\\-]", "");
        boolean valid = "CAR".equals(normalizedType)
                ? CURRENT_CAR.matcher(normalized).matches()
                : CURRENT_BIKE.matcher(normalized).matches()
                || LEGACY_BIKE_SHORT.matcher(normalized).matches()
                || LEGACY_BIKE_LONG.matcher(normalized).matches();

        if (!valid) {
            throw invalid("Invalid Vietnamese license plate for vehicle type " + normalizedType);
        }
        return normalized;
    }

    public static String normalizeVehicleType(String vehicleType) {
        if (vehicleType == null || vehicleType.isBlank()) {
            throw invalid("Vehicle type is required");
        }

        return switch (vehicleType.trim().toUpperCase(Locale.ROOT)) {
            case "CAR", "AUTO" -> "CAR";
            case "BIKE", "MOTORBIKE", "MOTORCYCLE", "XE_MAY" -> "BIKE";
            default -> throw invalid("Unsupported vehicle type: " + vehicleType);
        };
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
