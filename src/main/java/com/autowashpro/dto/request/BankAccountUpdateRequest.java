package com.autowashpro.dto.request;

import lombok.Data;

@Data
public class BankAccountUpdateRequest {

    private String bankCode;

    private String bankName;

    private String accountNumber;

    private String accountHolderName;
}
