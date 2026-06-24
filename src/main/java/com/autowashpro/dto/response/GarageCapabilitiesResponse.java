package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class GarageCapabilitiesResponse {
    private Long garageId;
    private List<String> supportedVehicleTypes;
}