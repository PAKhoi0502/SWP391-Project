package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateExceptionReportStatusRequest {

    /** PENDING, REVIEWED, RESOLVED, or REJECTED. */
    @NotBlank(message = "Status is required")
    private String status;

    /** Optional note/response from the admin, shown back to the customer. */
    private String note;
}
