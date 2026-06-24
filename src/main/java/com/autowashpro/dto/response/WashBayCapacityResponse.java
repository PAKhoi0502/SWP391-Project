package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class WashBayCapacityResponse {
    private Long garageId;
    private Map<String, Long> availableCountByVehicleType;
}