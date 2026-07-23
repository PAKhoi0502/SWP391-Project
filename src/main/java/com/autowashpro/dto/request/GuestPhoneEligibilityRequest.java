package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GuestPhoneEligibilityRequest {

    @NotBlank(message = "Phone number is required")
    private String phone;
}
