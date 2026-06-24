package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class WashBayCreateRequest {

    @NotNull
    private Long garageId;

    @NotBlank
    private String name; // maps to bay_code

    @NotBlank
    private String vehicleType; // CAR hoặc BIKE

    // status mặc định AVAILABLE khi tạo mới, không cần truyền vào
}