package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class VehicleInspectionResponse {
    private Long id;
    private Long bookingId;
    private Long vehicleId;
    private String vehicleName;
    private Long garageId;
    private String garageName;
    private Long inspectedByStaffId;
    private String inspectedByStaffName;
    private String type;
    private String exteriorCondition;
    private String interiorCondition;
    private String notes;
    private List<VehicleInspectionImageResponse> images;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
