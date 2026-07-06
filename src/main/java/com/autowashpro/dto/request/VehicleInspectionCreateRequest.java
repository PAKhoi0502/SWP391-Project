package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class VehicleInspectionCreateRequest {

    @NotBlank
    private String inspectionType;

    private String notes;

    private List<String> imagePublicIds;

    private String exteriorCondition;

    private String interiorCondition;
}
