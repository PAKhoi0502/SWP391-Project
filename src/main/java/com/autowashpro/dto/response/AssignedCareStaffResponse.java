package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AssignedCareStaffResponse {
    private Long staffProfileId;
    private String displayName;
    private String staffCode;
    private String assignmentStatus;
}
