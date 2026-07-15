package com.autowashpro.controller;

import com.autowashpro.dto.request.BankAccountCreateRequest;
import com.autowashpro.dto.request.BankAccountStatusUpdateRequest;
import com.autowashpro.dto.request.BankAccountUpdateRequest;
import com.autowashpro.dto.response.BankAccountResponse;
import com.autowashpro.service.BankAccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class BankAccountController {

    private final BankAccountService bankAccountService;

    @PostMapping("/api/bank-accounts")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<BankAccountResponse> create(
            @Valid @RequestBody BankAccountCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ResponseEntity.ok(bankAccountService.create(request, customerId));
    }

    @GetMapping("/api/bank-accounts")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<List<BankAccountResponse>> listOwn(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ResponseEntity.ok(bankAccountService.listOwn(customerId));
    }

    @PatchMapping("/api/bank-accounts/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<BankAccountResponse> update(
            @PathVariable Long id,
            @RequestBody BankAccountUpdateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ResponseEntity.ok(bankAccountService.update(id, request, customerId));
    }

    @PatchMapping("/api/bank-accounts/{id}/default")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<BankAccountResponse> setDefault(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ResponseEntity.ok(bankAccountService.setDefault(id, customerId));
    }

    @PatchMapping("/api/bank-accounts/{id}/status")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<BankAccountResponse> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody BankAccountStatusUpdateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ResponseEntity.ok(bankAccountService.updateStatus(id, request, customerId));
    }
}
