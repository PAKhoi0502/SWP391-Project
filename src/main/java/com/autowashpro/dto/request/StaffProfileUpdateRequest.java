package com.autowashpro.dto.request;

import com.autowashpro.entity.enums.StaffType;
import lombok.Data;

@Data
public class StaffProfileUpdateRequest {
    private Long garageId;
    private StaffType staffType;
}