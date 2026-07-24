package com.autowashpro.scheduler;

import com.autowashpro.service.BookingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DepositTimeoutScheduler {

    private final BookingService bookingService;

    @Value("${deposit.scheduler.enabled:true}")
    private boolean schedulerEnabled;

    @Scheduled(fixedDelayString = "${deposit.scheduler.interval-ms:60000}")
    public void expirePendingDeposits() {
        if (!schedulerEnabled) {
            return;
        }
        try {
            bookingService.expirePendingDeposits();
        } catch (Exception ex) {
            log.error("[DEPOSIT_SCHEDULER] Failed to expire pending deposit bookings", ex);
        }
    }

}