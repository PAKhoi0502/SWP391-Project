package com.autowashpro.repository;

import com.autowashpro.entity.PointTransactionAllocation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PointTransactionAllocationRepository extends JpaRepository<PointTransactionAllocation, Long> {

    List<PointTransactionAllocation> findByDebitTransactionId(Long debitTransactionId);

    List<PointTransactionAllocation> findByCreditTransactionId(Long creditTransactionId);

    boolean existsByDebitTransactionIdAndCreditTransactionId(Long debitTransactionId, Long creditTransactionId);
}
