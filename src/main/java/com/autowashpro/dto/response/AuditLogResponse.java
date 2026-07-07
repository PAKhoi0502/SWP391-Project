package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.Map;

@Getter
@Builder
public class AuditLogResponse {
    private Long id;
    private Long actorId;
    private String action;
    private String targetType;
    private Long targetId;
    private Map<String, Object> metadata;
    private LocalDateTime createdAt;
}
