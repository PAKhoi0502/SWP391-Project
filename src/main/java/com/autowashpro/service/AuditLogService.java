package com.autowashpro.service;

import com.autowashpro.dto.response.AuditLogResponse;
import com.autowashpro.dto.response.PageResponse;

import java.time.LocalDate;
import java.util.Map;

public interface AuditLogService {

    void createAuditLog(Long actorId, String action, String targetType, Long targetId, Map<String, ?> metadata);

    PageResponse<AuditLogResponse> list(
            int page,
            int limit,
            Long actorId,
            String action,
            String targetType,
            LocalDate from,
            LocalDate to);

    AuditLogResponse getById(Long id);
}
