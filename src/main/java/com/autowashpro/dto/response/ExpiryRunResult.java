package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class ExpiryRunResult {
    private Long logId;
    private String triggerType;     // SCHEDULED | MANUAL
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private String status;          // RUNNING | SUCCESS | PARTIAL_FAILURE | FAILURE | NEVER_RUN
    private int customersProcessed;
    private int customersSucceeded;
    private int customersFailed;
    private int lotsExpired;
    private int pointsExpired;
    private List<Long> failedCustomers;
    private String errorSummary;
}
