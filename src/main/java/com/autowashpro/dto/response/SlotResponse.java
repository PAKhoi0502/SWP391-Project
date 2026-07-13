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

    private String fullReason; // NO_BAY | NO_CARE_STAFF — populated when available=false
}