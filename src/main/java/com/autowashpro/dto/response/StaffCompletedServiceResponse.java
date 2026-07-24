package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class StaffCompletedServiceResponse {
    private Long bookingId;
    private LocalDateTime completedAt;
    private String servicePackageName;
    private List<String> addOnNames;
}
