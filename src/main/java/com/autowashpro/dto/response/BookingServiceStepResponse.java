package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class BookingServiceStepResponse {

    private Long id;

    private Long bookingId;

    private Long servicePackageId;

    private Long servicePackageStepId;

    private Integer stepOrder;

    private String name;

    private String description;

    private String status;

    private LocalDateTime startedAt;

    private LocalDateTime completedAt;

    private Long completedByStaffId;

}