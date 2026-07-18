package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateDepositRefundRequest {

    @NotNull
    private Long bankAccountId;
}
