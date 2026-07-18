package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BankAccountCreateRequest {

    @NotBlank
    private String bankCode;

    @NotBlank
    private String bankName;

    @NotBlank
    private String accountNumber;

    @NotBlank
    private String accountHolderName;

    private Boolean isDefault = false;
}
