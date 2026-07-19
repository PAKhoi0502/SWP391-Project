package com.autowashpro.repository;

import com.autowashpro.entity.DepositRefund;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DepositRefundRepository extends JpaRepository<DepositRefund, Long> {

        Optional<DepositRefund> findFirstByBookingIdAndStatusInOrderByRequestedAtDesc(
                        Long bookingId,
                        List<String> statuses);

        List<DepositRefund> findByCustomerIdOrderByRequestedAtDesc(Long customerId);

        Page<DepositRefund> findByStatusOrderByRequestedAtDesc(String status, Pageable pageable);

        Page<DepositRefund> findAllByOrderByRequestedAtDesc(Pageable pageable);
}
