package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class BookingExceptionReportResponse {

    private Long id;
    private Long bookingId;
    private Long customerId;
    private String customerName;
    private String customerPhone;
    private String category;
    private String description;
    private String status;
    private String adminNote;
    private List<String> imageUrls;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private String garageName;
    private String servicePackageName;
    private String vehicleName;
    private String licensePlate;

    /** Only populated by the admin detail endpoint — the staff's own before/after wash photos for comparison. */
    private List<VehicleInspectionResponse> staffInspections;
}
