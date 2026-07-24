package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GoogleAuthRequest {

    @NotBlank
    private String idToken;

    /** Required only when the Google sign-in creates a brand-new account. */
    private String phone;
}
