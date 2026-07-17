package com.autowashpro.scheduler;

import com.autowashpro.entity.PaymentTransaction;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentTransactionExpiryScheduler {

    private final PaymentTransactionRepository transactionRepository;
    private final BookingRepository bookingRepository;

    @Value("${payment.expiry-scheduler.enabled:true}")
    private boolean schedulerEnabled;

    @Scheduled(fixedRateString = "${payment.expiry-scheduler.interval-ms:300000}")
    @Transactional
    public void expireOverduePendingTransactions() {
        if (!schedulerEnabled) {
            return;
        }

        List<PaymentTransaction> overdue = transactionRepository
                .findByStatusAndExpiredAtBefore("PENDING", LocalDateTime.now());

        for (PaymentTransaction transaction : overdue) {
            transaction.setStatus("EXPIRED");
            transactionRepository.save(transaction);
            log.info("[PAYMENT_EXPIRY_SCHEDULER] Expired transaction #{} (booking #{}, purpose {})",
                    transaction.getId(), transaction.getBookingId(), transaction.getPurpose());

            if ("DEPOSIT".equals(transaction.getPurpose())) {
                bookingRepository.findById(transaction.getBookingId()).ifPresent(booking -> {
                    if (!"PAID".equals(booking.getDepositStatus())) {
                        booking.setDepositStatus("EXPIRED");
                        bookingRepository.save(booking);
                    }
                });
            }
        }
    }
}
