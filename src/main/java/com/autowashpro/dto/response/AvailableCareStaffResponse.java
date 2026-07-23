package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

/** Minimal projection returned by GET /bookings/{id}/available-care-staff. */
@Data
@Builder
public class AvailableCareStaffResponse {
    private Long staffProfileId;
    private String displayName;
    private String staffCode;
    private Long garageId;
}
