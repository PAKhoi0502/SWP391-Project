package com.autowashpro.repository;

import com.autowashpro.entity.PointTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PointTransactionRepository extends JpaRepository<PointTransaction, Long> {
    Page<PointTransaction> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);
    Optional<PointTransaction> findByBookingIdAndType(Long bookingId, String type);
    List<PointTransaction> findByCustomerIdAndTypeOrderByExpiredAtAsc(Long customerId, String type);

Page<PointTransaction> findByCustomerIdAndTypeOrderByCreatedAtDesc(Long customerId, String type, Pageable pageable);
}