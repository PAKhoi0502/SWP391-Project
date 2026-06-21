package com.autowashpro.dto.request;

import com.autowashpro.entity.enums.StaffType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StaffProfileCreateRequest {

    @NotNull
    private Long userId;

    @NotNull
    private Long garageId;

    @NotBlank
    private String staffCode;

    @NotNull
    private StaffType staffType;
}