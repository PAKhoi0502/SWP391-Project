package com.autowashpro.common;

import java.util.LinkedHashMap;
import java.util.Map;

public final class AuditMetadata {

    public static Map<String, Object> of(Object... entries) {
        if (entries.length % 2 != 0) {
            throw new IllegalArgumentException("Audit metadata entries must be key-value pairs");
        }
        Map<String, Object> metadata = new LinkedHashMap<>();
        for (int index = 0; index < entries.length; index += 2) {
            metadata.put(String.valueOf(entries[index]), entries[index + 1]);
        }
        return metadata;
    }

    private AuditMetadata() {
    }
}
