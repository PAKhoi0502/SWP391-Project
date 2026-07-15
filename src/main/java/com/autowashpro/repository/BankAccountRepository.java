package com.autowashpro.repository;

import com.autowashpro.entity.BankAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BankAccountRepository extends JpaRepository<BankAccount, Long> {

    List<BankAccount> findByCustomer_IdAndIsActiveTrue(Long customerId);

    Optional<BankAccount> findByIdAndCustomer_Id(Long id, Long customerId);

    boolean existsByCustomer_IdAndBankCodeAndAccountNumberAndIsActiveTrue(
            Long customerId, String bankCode, String accountNumber);

    // Reset tất cả tài khoản ngân hàng của customer về is_default=false trước khi set default mới
    @Modifying
    @Query("UPDATE BankAccount b SET b.isDefault = false WHERE b.customer.id = :customerId")
    void clearDefaultByCustomerId(@Param("customerId") Long customerId);
}
