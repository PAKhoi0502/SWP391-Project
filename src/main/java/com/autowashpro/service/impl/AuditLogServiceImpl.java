package com.autowashpro.service.impl;

import com.autowashpro.dto.response.AuditLogResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.entity.AuditLog;
import com.autowashpro.repository.AuditLogRepository;
import com.autowashpro.repository.spec.AuditLogSpecifications;
import com.autowashpro.service.AuditLogService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogServiceImpl implements AuditLogService {

    private static final int MAX_LIMIT = 100;
    private static final Set<String> SENSITIVE_KEY_PARTS = Set.of(
            "password",
            "refreshtoken",
            "resettoken",
            "accesstoken",
            "authorization",
            "secret",
            "apikey",
            "checksumkey",
            "privatekey",
            "credential"
    );

    private final AuditLogRepository auditLogRepository;
    private final AuditLogWriter auditLogWriter;
    private final ObjectMapper objectMapper;

    @Override
    public void createAuditLog(
            Long actorId,
            String action,
            String targetType,
            Long targetId,
            Map<String, ?> metadata) {
        try {
            if (action == null || action.isBlank() || targetType == null || targetType.isBlank() || targetId == null) {
                log.warn("Audit log skipped because required fields are missing");
                return;
            }

            String normalizedAction = action.trim().toUpperCase(Locale.ROOT);
            String normalizedTargetType = targetType.trim().toUpperCase(Locale.ROOT);
            String sanitizedMetadata = serializeSanitized(metadata);
            Runnable write = () -> writeSafely(actorId, normalizedAction, normalizedTargetType, targetId, sanitizedMetadata);

            if (TransactionSynchronizationManager.isActualTransactionActive()
                    && TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        write.run();
                    }
                });
                return;
            }

            write.run();
        } catch (Exception exception) {
            log.error("Audit log creation failed");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AuditLogResponse> list(
            int page,
            int limit,
            Long actorId,
            String action,
            String targetType,
            LocalDate from,
            LocalDate to) {
        validatePaging(page, limit);
        if (from != null && to != null && from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from must be on or before to");
        }

        LocalDateTime fromTime = from == null ? null : from.atStartOfDay();
        LocalDateTime toExclusive = to == null ? null : to.plusDays(1).atStartOfDay();
        Specification<AuditLog> specification = Specification.allOf(
                AuditLogSpecifications.actorIdEquals(actorId),
                AuditLogSpecifications.actionEquals(action),
                AuditLogSpecifications.targetTypeEquals(targetType),
                AuditLogSpecifications.createdAtFrom(fromTime),
                AuditLogSpecifications.createdAtBefore(toExclusive));
        Page<AuditLog> result = auditLogRepository.findAll(
                specification,
                PageRequest.of(page - 1, limit, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));

        return PageResponse.<AuditLogResponse>builder()
                .data(result.getContent().stream().map(this::toResponse).toList())
                .page(page)
                .limit(limit)
                .totalItems(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public AuditLogResponse getById(Long id) {
        AuditLog auditLog = auditLogRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Audit log not found: " + id));
        return toResponse(auditLog);
    }

    private void writeSafely(Long actorId, String action, String targetType, Long targetId, String metadata) {
        try {
            auditLogWriter.write(actorId, action, targetType, targetId, metadata);
        } catch (Exception exception) {
            log.error("Audit log write failed for action {} and target {}:{}", action, targetType, targetId);
        }
    }

    private String serializeSanitized(Map<String, ?> metadata) {
        Map<String, ?> source = metadata == null ? Map.of() : metadata;
        JsonNode sanitized = sanitizeNode(objectMapper.valueToTree(source));
        try {
            return objectMapper.writeValueAsString(sanitized);
        } catch (JsonProcessingException exception) {
            log.warn("Audit metadata serialization failed");
            return "{}";
        }
    }

    private JsonNode sanitizeNode(JsonNode node) {
        if (node == null || node.isNull()) {
            return objectMapper.nullNode();
        }
        if (node.isObject()) {
            ObjectNode sanitized = objectMapper.createObjectNode();
            node.properties().forEach(entry -> sanitized.set(
                    entry.getKey(),
                    isSensitive(entry.getKey()) ? TextNode.valueOf("[REDACTED]") : sanitizeNode(entry.getValue())));
            return sanitized;
        }
        if (node.isArray()) {
            ArrayNode sanitized = objectMapper.createArrayNode();
            node.forEach(value -> sanitized.add(sanitizeNode(value)));
            return sanitized;
        }
        return node.deepCopy();
    }

    private boolean isSensitive(String key) {
        String normalized = key.replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.ROOT);
        return SENSITIVE_KEY_PARTS.stream().anyMatch(normalized::contains);
    }

    private AuditLogResponse toResponse(AuditLog auditLog) {
        return AuditLogResponse.builder()
                .id(auditLog.getId())
                .actorId(auditLog.getActorId())
                .action(auditLog.getAction())
                .targetType(auditLog.getTargetType())
                .targetId(auditLog.getTargetId())
                .metadata(deserializeMetadata(auditLog.getMetadata()))
                .createdAt(auditLog.getCreatedAt())
                .build();
    }

    private Map<String, Object> deserializeMetadata(String metadata) {
        if (metadata == null || metadata.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(metadata, new TypeReference<LinkedHashMap<String, Object>>() {
            });
        } catch (JsonProcessingException exception) {
            return Map.of();
        }
    }

    private void validatePaging(int page, int limit) {
        if (page < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page must be at least 1");
        }
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "limit must be between 1 and 100");
        }
    }
}
