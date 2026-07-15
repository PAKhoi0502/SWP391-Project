package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class BankAccountStatusUpdateRequest {
    @NotNull
    private Boolean isActive;
}
