package com.autowashpro.dto.response;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SlotResponse {

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Boolean available;

    private String fullReason; // NO_WASH_BAY | NO_CARE_STAFF | GARAGE_CLOSED — populated when available=false

    // ===================== ISSUE #169 wash/care windows =====================
    private LocalDateTime washStartAt;
    private LocalDateTime washEndAt;
    private LocalDateTime careStartAt;
    private LocalDateTime careEndAt;
}