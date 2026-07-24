package com.autowashpro.service.support;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.regex.Pattern;

public final class VietnamesePhoneNumber {

    private static final Pattern ALLOWED_INPUT = Pattern.compile("^[0-9+\\s.()\\-]+$");
    private static final Pattern LOCAL_MOBILE = Pattern.compile("^0[35789]\\d{8}$");
    private static final Pattern INTERNATIONAL_MOBILE = Pattern.compile("^\\+84[35789]\\d{8}$");

    private VietnamesePhoneNumber() {
    }

    public static String normalizeMobile(String input) {
        if (input == null || input.isBlank()) {
            throw invalid("Phone number is required");
        }

        String trimmed = input.trim();
        if (!ALLOWED_INPUT.matcher(trimmed).matches()) {
            throw invalid("Phone number contains unsupported characters");
        }

        String compact = trimmed.replaceAll("[\\s.()\\-]", "");
        if (LOCAL_MOBILE.matcher(compact).matches()) {
            return "+84" + compact.substring(1);
        }
        if (INTERNATIONAL_MOBILE.matcher(compact).matches()) {
            return compact;
        }

        throw invalid("Invalid Vietnamese mobile phone number");
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
