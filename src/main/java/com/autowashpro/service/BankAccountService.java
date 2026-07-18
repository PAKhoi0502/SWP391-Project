package com.autowashpro.service;

import com.autowashpro.dto.request.BankAccountCreateRequest;
import com.autowashpro.dto.request.BankAccountStatusUpdateRequest;
import com.autowashpro.dto.request.BankAccountUpdateRequest;
import com.autowashpro.dto.response.BankAccountResponse;

import java.util.List;

public interface BankAccountService {
    BankAccountResponse create(BankAccountCreateRequest request, Long customerId);
    List<BankAccountResponse> listOwn(Long customerId);
    BankAccountResponse update(Long id, BankAccountUpdateRequest request, Long customerId);
    BankAccountResponse setDefault(Long id, Long customerId);
    BankAccountResponse updateStatus(Long id, BankAccountStatusUpdateRequest request, Long customerId);
}
