package com.autowashpro.dto.response;

import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddOnAvailabilityResponse {

    private Long servicePackageId;

    private Boolean available;

    private String reason; // populated when available=false, e.g. CARE_STAFF_CAPACITY_FULL
}
