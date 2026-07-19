package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RejectDepositRefundRequest {

    @NotBlank
    @Size(max = 500)
    private String reason;
}
