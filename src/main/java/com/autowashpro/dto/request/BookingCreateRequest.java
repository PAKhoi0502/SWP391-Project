package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class BookingCreateRequest {

    @NotNull
    private Long garageId;

    @NotNull
    private Long vehicleId;

    @NotNull
    private Long servicePackageId;

    private List<Long> addOnServicePackageIds = new ArrayList<>();

    @NotNull
    private LocalDateTime startTime;

    private String promotionCode;

    private Integer usedPoints = 0;

    private String paymentMethod;

    private String note;

}
