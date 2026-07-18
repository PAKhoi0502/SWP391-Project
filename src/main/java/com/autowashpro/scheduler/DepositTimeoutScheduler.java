package com.autowashpro.scheduler;

import com.autowashpro.service.BookingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DepositTimeoutScheduler {

    private final BookingService bookingService;

    @Scheduled(
            fixedDelayString = "${deposit.scheduler.interval-ms:60000}")
    public void expirePendingDeposits() {

        try {

            bookingService.expirePendingDeposits();

        } catch (Exception ex) {

            log.error(
                    "Failed to expire pending deposit bookings",
                    ex);

        }

    }

}