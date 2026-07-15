package com.autowashpro.service.impl;

import com.autowashpro.dto.request.BankAccountCreateRequest;
import com.autowashpro.dto.request.BankAccountStatusUpdateRequest;
import com.autowashpro.dto.request.BankAccountUpdateRequest;
import com.autowashpro.dto.response.BankAccountResponse;
import com.autowashpro.entity.BankAccount;
import com.autowashpro.entity.User;
import com.autowashpro.repository.BankAccountRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.service.BankAccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BankAccountServiceImpl implements BankAccountService {

    private final BankAccountRepository bankAccountRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public BankAccountResponse create(BankAccountCreateRequest request, Long customerId) {
        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Customer not found: " + customerId));

        if (bankAccountRepository.existsByCustomer_IdAndBankCodeAndAccountNumberAndIsActiveTrue(
                customerId, request.getBankCode(), request.getAccountNumber())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This bank account is already saved");
        }

        BankAccount bankAccount = new BankAccount();
        bankAccount.setCustomer(customer);
        bankAccount.setBankCode(request.getBankCode());
        bankAccount.setBankName(request.getBankName());
        bankAccount.setAccountNumber(request.getAccountNumber());
        bankAccount.setAccountHolderName(request.getAccountHolderName());
        bankAccount.setIsActive(true);

        boolean setDefault = Boolean.TRUE.equals(request.getIsDefault())
                || bankAccountRepository.findByCustomer_IdAndIsActiveTrue(customerId).isEmpty();

        if (setDefault) {
            bankAccountRepository.clearDefaultByCustomerId(customerId);
            bankAccount.setIsDefault(true);
        } else {
            bankAccount.setIsDefault(false);
        }

        return toResponse(bankAccountRepository.save(bankAccount));
    }

    @Override
    public List<BankAccountResponse> listOwn(Long customerId) {
        return bankAccountRepository.findByCustomer_IdAndIsActiveTrue(customerId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public BankAccountResponse update(Long id, BankAccountUpdateRequest request, Long customerId) {
        BankAccount bankAccount = bankAccountRepository.findByIdAndCustomer_Id(id, customerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Bank account not found or not owned by current user"));

        if (request.getAccountHolderName() != null) {
            bankAccount.setAccountHolderName(request.getAccountHolderName());
        }

        return toResponse(bankAccountRepository.save(bankAccount));
    }

    @Override
    @Transactional
    public BankAccountResponse setDefault(Long id, Long customerId) {
        BankAccount bankAccount = bankAccountRepository.findByIdAndCustomer_Id(id, customerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Bank account not found or not owned by current user"));

        if (!Boolean.TRUE.equals(bankAccount.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot set inactive bank account as default");
        }

        bankAccountRepository.clearDefaultByCustomerId(customerId);
        bankAccount.setIsDefault(true);

        return toResponse(bankAccountRepository.save(bankAccount));
    }

    @Override
    @Transactional
    public BankAccountResponse updateStatus(Long id, BankAccountStatusUpdateRequest request, Long customerId) {
        BankAccount bankAccount = bankAccountRepository.findByIdAndCustomer_Id(id, customerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Bank account not found or not owned by current user"));

        bankAccount.setIsActive(request.getIsActive());

        if (!Boolean.TRUE.equals(request.getIsActive())
                && Boolean.TRUE.equals(bankAccount.getIsDefault())) {
            bankAccount.setIsDefault(false);
        }

        return toResponse(bankAccountRepository.save(bankAccount));
    }

    private BankAccountResponse toResponse(BankAccount b) {
        return BankAccountResponse.builder()
                .id(b.getId())
                .customerId(b.getCustomer() != null ? b.getCustomer().getId() : null)
                .bankCode(b.getBankCode())
                .bankName(b.getBankName())
                .accountNumber(b.getAccountNumber())
                .accountHolderName(b.getAccountHolderName())
                .isDefault(b.getIsDefault())
                .isActive(b.getIsActive())
                .createdAt(b.getCreatedAt())
                .updatedAt(b.getUpdatedAt())
                .build();
    }
}
