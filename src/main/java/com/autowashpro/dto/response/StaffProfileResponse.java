package com.autowashpro.dto.response;

import com.autowashpro.entity.enums.StaffType;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class StaffProfileResponse {
    private Long id;
    private Long userId;
    private String userFullName;
    private Long garageId;
    private String staffCode;
    private StaffType staffType;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}