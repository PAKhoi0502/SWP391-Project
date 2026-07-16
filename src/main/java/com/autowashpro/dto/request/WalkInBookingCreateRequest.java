package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class WalkInBookingCreateRequest {

    @NotNull
    private Long garageId;

    @NotBlank
    private String guestName;

    @NotBlank
    private String guestPhone;

    private String guestEmail; // không có cột trong DB, bỏ qua khi lưu

    @NotBlank
    private String licensePlate;

    @NotBlank
    private String vehicleType; // CAR hoặc BIKE

    @NotNull
    private Long servicePackageId;

    private List<Long> addOnServicePackageIds;

    @NotNull
    private LocalDateTime startTime;

    private String note;

    private Integer seatCount;

    private String motorbikeGroup;

    private String vehicleBrand;

    private String vehicleModel;

    @NotBlank
    private String depositPaymentMethod;// NONE | CASH | PAYOS
}
