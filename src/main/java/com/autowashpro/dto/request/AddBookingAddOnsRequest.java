package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class AddBookingAddOnsRequest {

    @NotEmpty(message = "servicePackageIds is required")
    @Size(max = 10, message = "A maximum of 10 add-on service packages can be added at once")
    private List<@NotNull(message = "servicePackageId cannot be null") Long> servicePackageIds;
}
