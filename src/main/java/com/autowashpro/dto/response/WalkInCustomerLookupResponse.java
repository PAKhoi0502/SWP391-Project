package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class WalkInCustomerLookupResponse {

    private Boolean found;

    private Long customerId;

    private String fullName;

    private String phone;

    private String email;

    // Matched vehicle (when licensePlate input matches an existing vehicle)
    private Long vehicleId;

    private String licensePlate;

    private String vehicleType;

    private String vehicleName;

    // All registered vehicles for this customer
    private List<VehicleSummary> vehicles;

    @Data
    @Builder
    public static class VehicleSummary {
        private Long id;
        private String licensePlate;
        private String vehicleType;
        private String vehicleName;
    }
}
