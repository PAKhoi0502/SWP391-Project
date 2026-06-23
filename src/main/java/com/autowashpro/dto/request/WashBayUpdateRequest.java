package com.autowashpro.dto.request;

import lombok.Data;

@Data
public class WashBayUpdateRequest {
    private String name;       // maps to bay_code
    private String vehicleType;
}