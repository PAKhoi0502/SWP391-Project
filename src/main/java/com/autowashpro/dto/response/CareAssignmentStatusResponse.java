package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

/** Returned by GET /bookings/{id}/care-assignment-status. */
@Data
@Builder
public class CareAssignmentStatusResponse {
    private Boolean requiresCareStaff;
    private Integer requiredCount;
    private Integer assignedCount;
    private Boolean shortage;
    private LocalDateTime plannedCareStartAt;
    private LocalDateTime plannedCareEndAt;
    /** True when it is permitted to call assignCareStaff for this booking right now. */
    private Boolean canAssign;
    private String operationPhase;
}
