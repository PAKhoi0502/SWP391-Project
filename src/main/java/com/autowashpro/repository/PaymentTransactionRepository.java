package com.autowashpro.repository;

import com.autowashpro.entity.PaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {
    List<PaymentTransaction> findByBookingIdOrderByCreatedAtDesc(Long bookingId);
    Optional<PaymentTransaction> findByOrderCode(Long orderCode);
    Optional<PaymentTransaction> findByBookingIdAndStatus(Long bookingId, String status);
    List<PaymentTransaction> findByBookingIdAndPurposeOrderByCreatedAtDesc(Long bookingId, String purpose);
    Optional<PaymentTransaction> findByBookingIdAndStatusAndPurpose(Long bookingId, String status, String purpose);
    List<PaymentTransaction> findByStatusAndExpiredAtBefore(String status, LocalDateTime time);
}