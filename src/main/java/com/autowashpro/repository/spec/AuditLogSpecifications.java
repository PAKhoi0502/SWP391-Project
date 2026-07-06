package com.autowashpro.repository.spec;

import com.autowashpro.entity.AuditLog;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;

public final class AuditLogSpecifications {

    public static Specification<AuditLog> actorIdEquals(Long actorId) {
        return (root, query, cb) -> actorId == null ? null : cb.equal(root.get("actorId"), actorId);
    }

    public static Specification<AuditLog> actionEquals(String action) {
        return (root, query, cb) -> isBlank(action) ? null : cb.equal(root.get("action"), action.trim().toUpperCase());
    }

    public static Specification<AuditLog> targetTypeEquals(String targetType) {
        return (root, query, cb) -> isBlank(targetType)
                ? null
                : cb.equal(root.get("targetType"), targetType.trim().toUpperCase());
    }

    public static Specification<AuditLog> createdAtFrom(LocalDateTime from) {
        return (root, query, cb) -> from == null ? null : cb.greaterThanOrEqualTo(root.get("createdAt"), from);
    }

    public static Specification<AuditLog> createdAtBefore(LocalDateTime toExclusive) {
        return (root, query, cb) -> toExclusive == null ? null : cb.lessThan(root.get("createdAt"), toExclusive);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private AuditLogSpecifications() {
    }
}
