package com.autowashpro.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class VehicleInspectionUpdateRequest {
    private String notes;
    private String exteriorCondition;
    private String interiorCondition;
    private List<String> images;
}