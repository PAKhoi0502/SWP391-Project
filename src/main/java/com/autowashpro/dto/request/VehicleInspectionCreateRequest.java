package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class VehicleInspectionCreateRequest {

    @NotBlank
    private String inspectionType; // BEFORE_WASH hoặc AFTER_WASH

    private String notes;

    private List<String> images; // danh sách URL ảnh

    private String exteriorCondition; // JSON string hoặc text mô tả

    private String interiorCondition; // JSON string hoặc text mô tả
}