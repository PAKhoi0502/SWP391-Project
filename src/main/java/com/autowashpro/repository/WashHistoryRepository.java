package com.autowashpro.repository;

import com.autowashpro.entity.WashHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WashHistoryRepository extends JpaRepository<WashHistory, Long> {

    Optional<WashHistory> findByBookingId(Long bookingId);

    Page<WashHistory> findByCustomerIdOrderByCompletedAtDesc(Long customerId, Pageable pageable);

    Page<WashHistory> findAllByOrderByCompletedAtDesc(Pageable pageable);

    Page<WashHistory> findByGarageIdOrderByCompletedAtDesc(Long garageId, Pageable pageable);

    Page<WashHistory> findByCustomerIdAndGarageIdOrderByCompletedAtDesc(Long customerId, Long garageId, Pageable pageable);
}