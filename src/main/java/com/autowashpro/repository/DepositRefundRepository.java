package com.autowashpro.repository;

import com.autowashpro.entity.DepositRefund;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

public interface DepositRefundRepository extends JpaRepository<DepositRefund, Long> {

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("SELECT r FROM DepositRefund r WHERE r.id = :id")
        Optional<DepositRefund> findByIdWithLock(@Param("id") Long id);

        Optional<DepositRefund> findFirstByBookingIdAndStatusInOrderByRequestedAtDesc(
                        Long bookingId,
                        List<String> statuses);

        List<DepositRefund> findByCustomerIdOrderByRequestedAtDesc(Long customerId);

        Page<DepositRefund> findByStatusOrderByRequestedAtDesc(String status, Pageable pageable);

        Page<DepositRefund> findAllByOrderByRequestedAtDesc(Pageable pageable);
}
