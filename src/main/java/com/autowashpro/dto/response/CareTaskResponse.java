package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Read-only view for VEHICLE_CARE_STAFF showing their assigned care tasks.
 * Must NOT expose any payment, loyalty, refund, or bank data.
 */
@Data
@Builder
public class CareTaskResponse {

    private Long assignmentId;
    private Long bookingId;
    private String vehicleType;
    private String licensePlate;
    private String servicePackageName;
    private List<String> addOnNames;
    private List<String> serviceNames;
    private String instructions;
    private List<String> tasks;

    private LocalDateTime expectedStartTime;
    private LocalDateTime expectedEndTime;
    private LocalDateTime plannedStartAt;
    private LocalDateTime plannedEndAt;

    private String previousWashBay;
    private String lane;

    /** Assignment status: RESERVED, ACTIVE, RELEASED, CANCELED */
    private String status;

    /** Note left by the Service Staff for the care team */
    private String serviceStaffNote;

    private String bookingOperationPhase;
}
