package com.autowashpro.util;

public final class DisplayNameHelper {

    private DisplayNameHelper() {}

    /**
     * Masks full name for public display.
     * "Hoàng Thanh"    → "Hoàng T."
     * "Nguyễn Văn An"  → "Nguyễn A."
     * "Alice"           → "Alice"
     * null/blank        → "Customer"
     */
    public static String buildDisplayName(String fullName) {
        if (fullName == null || fullName.isBlank()) return "Customer";
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) return parts[0];
        return parts[0] + " " + parts[parts.length - 1].charAt(0) + ".";
    }

    /**
     * Builds 1–2 initials for avatar fallback.
     * "Hoàng Thanh"    → "HT"
     * "Nguyễn Văn An"  → "NA"
     * "Alice"           → "A"
     * null/blank        → "U"
     */
    public static String buildInitials(String fullName) {
        if (fullName == null || fullName.isBlank()) return "U";
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) return String.valueOf(parts[0].charAt(0)).toUpperCase();
        return (String.valueOf(parts[0].charAt(0))
                + String.valueOf(parts[parts.length - 1].charAt(0))).toUpperCase();
    }
}
