package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdatePaymentMethodRequest {

    @NotBlank
    private String paymentMethod;
}
