package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class CreditLotResponse {
    private Long id;
    private Long customerId;
    private String type;
    private String source;
    private Long bookingId;
    private Integer totalPoints;
    private Integer remainingPoints;
    private Integer consumedPoints;
    private LocalDateTime createdAt;
    private LocalDateTime expiredAt;
    /** ACTIVE | EXPIRING_SOON | EXPIRED | CONSUMED — computed by backend */
    private String status;
    private String note;
    // deprecated booleans kept for backward compat but status supersedes them
    private boolean expired;
    private boolean fullyConsumed;
}
