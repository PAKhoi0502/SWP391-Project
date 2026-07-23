package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class CareTaskResponse {
    private Long bookingId;
    private Long assignmentId;
    private String licensePlate;
    private String servicePackageName;
    private List<String> addOnNames;
    private List<String> tasks;
    private LocalDateTime expectedStartTime;
    private LocalDateTime expectedEndTime;
    private String previousWashBay;
    private String lane;
}
