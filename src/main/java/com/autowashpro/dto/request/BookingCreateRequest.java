package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class BookingCreateRequest {

    @NotNull
    private Long garageId;

    @NotNull
    private Long vehicleId;

    @NotNull
    private Long servicePackageId;

    @NotNull
    private LocalDateTime startTime;

    private String promotionCode;

    private Integer usedPoints = 0;

    private String note;
}