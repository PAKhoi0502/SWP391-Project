package com.autowashpro.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ExecuteDepositRefundRequest {

    private boolean success = true;

    @Size(max = 500)
    private String note;

    @Size(max = 100)
    private String transactionReference;
}
