package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MarkBookingPaidRequest {

    @NotBlank
    private String paymentMethod;

    private String note;
}