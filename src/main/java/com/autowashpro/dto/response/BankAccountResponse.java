package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class BankAccountResponse {
    private Long id;
    private Long customerId;
    private String bankCode;
    private String bankName;
    private String accountNumber;
    private String accountHolderName;
    private Boolean isDefault;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
