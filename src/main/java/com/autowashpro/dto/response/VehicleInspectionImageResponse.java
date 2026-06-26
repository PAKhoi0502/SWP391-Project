package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class VehicleInspectionImageResponse {
    private Long id;
    private String imageUrl;
    private String publicId;
}