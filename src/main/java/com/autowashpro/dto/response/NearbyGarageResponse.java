package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class NearbyGarageResponse {
    private GarageResponse garage;
    private Double distanceKm;
    private Integer durationMinutes;
}
