package com.autowashpro.dto.request;

import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ExecuteDepositRefundRequest {

    @NotNull
    private Boolean success;

    @Size(max = 500)
    private String note;

    @Size(max = 100)
    private String transactionReference;
}
