package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class BookingExceptionReportCreateRequest {

    /** VEHICLE_CONDITION, SERVICE_QUALITY, BILLING, or OTHER. */
    @NotBlank(message = "Category is required")
    private String category;

    @NotBlank(message = "Description is required")
    private String description;

    private List<String> imageUrls;
}
