package com.autowashpro.scheduler;

import com.autowashpro.entity.Waitlist;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.WaitlistRepository;
import com.autowashpro.repository.WashBayRepository;
import com.autowashpro.service.NotificationService;
import com.autowashpro.service.EmailService;
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
public class WaitlistScheduler {

    private final WaitlistRepository waitlistRepository;
    private final BookingRepository bookingRepository;
    private final WashBayRepository washBayRepository;
    private final NotificationService notificationService;
    private final EmailService emailService;

    @Value("${waitlist.cutoff-hours}")
    private int cutoffHours;

    @Value("${waitlist.scheduler.enabled:true}")
    private boolean schedulerEnabled;

    // ===================== AUTO-FILL =====================

    @Scheduled(fixedRateString = "${waitlist.scheduler.interval-ms:300000}")
    @Transactional
    public void autoFillWaitlist() {
        if (!schedulerEnabled) {
            return;
        }

        log.info("[WAITLIST_SCHEDULER] Running auto-fill check at {}", LocalDateTime.now());

        // Step 1: Expire waitlists đã quá cutoff
        expireOverduWaitlists();

        // Step 2: Expire offers đã hết hạn
        expireExpiredOffers();

        // Step 3: Auto-fill slots trống
        autoFillAvailableSlots();
    }

    private void expireOverduWaitlists() {
        LocalDateTime cutoffThreshold = LocalDateTime.now().plusHours(cutoffHours);
        List<Waitlist> overdue = waitlistRepository.findByStatusAndDesiredStartTimeBefore(
                "WAITING", cutoffThreshold);

        for (Waitlist waitlist : overdue) {
            waitlist.setStatus("EXPIRED");
            waitlist.setExpiredAt(LocalDateTime.now());
            waitlistRepository.save(waitlist);
            log.info("[WAITLIST_SCHEDULER] Expired overdue waitlist #{}", waitlist.getId());
        }
    }

    private void expireExpiredOffers() {
    List<Waitlist> offeredList = waitlistRepository
            .findByStatusAndOfferExpiresAtBefore("OFFERED", LocalDateTime.now());

    for (Waitlist waitlist : offeredList) {
        waitlist.setStatus("EXPIRED");
        waitlist.setExpiredAt(LocalDateTime.now());
        waitlistRepository.save(waitlist);
        log.info("[WAITLIST_SCHEDULER] Expired offer for waitlist #{}", waitlist.getId());
    }
}

    private void autoFillAvailableSlots() {
        // Tìm tất cả waitlist WAITING còn hiệu lực
        LocalDateTime cutoffThreshold = LocalDateTime.now().plusHours(cutoffHours);
        List<Waitlist> waitingList = waitlistRepository.findByStatusAndDesiredStartTimeBefore(
                "WAITING", cutoffThreshold.plusDays(30));

        for (Waitlist waitlist : waitingList) {
            try {
                // Bỏ qua nếu đã qua cutoff
                LocalDateTime cutoffLimit = waitlist.getDesiredStartTime().minusHours(cutoffHours);
                if (LocalDateTime.now().isAfter(cutoffLimit)) {
                    continue;
                }

                // Check slot có trống không
                String bayType = normalizeVehicleType(waitlist.getVehicleType());
                long availableBays = washBayRepository.countAvailableByGarageAndVehicleType(
                        waitlist.getGarageId(), bayType);
                long occupiedBays = bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                        waitlist.getGarageId(), bayType,
                        waitlist.getDesiredStartTime(),
                        waitlist.getDesiredEndTime(), LocalDateTime.now());

                boolean slotAvailable = occupiedBays < availableBays;

                if (slotAvailable) {
                    // Auto-offer
                    waitlist.setStatus("OFFERED");
                    waitlist.setOfferedAt(LocalDateTime.now());
                    waitlist.setOfferExpiresAt(LocalDateTime.now().plusHours(2));
                    waitlistRepository.save(waitlist);

                    // Gửi notification + email
                    notificationService.notifyWaitlistOffered(waitlist.getId());
                    emailService.sendWaitlistOfferedEmail(waitlist.getId(), waitlist.getOfferExpiresAt());
                    log.info("[WAITLIST_SCHEDULER] Auto-offered waitlist #{} for customer #{} at garage #{}",
                            waitlist.getId(), waitlist.getCustomerId(), waitlist.getGarageId());
                }

            } catch (Exception e) {
                log.error("[WAITLIST_SCHEDULER] Error processing waitlist #{}: {}",
                        waitlist.getId(), e.getMessage());
            }
        }
    }

    private String normalizeVehicleType(String vehicleType) {
        if (vehicleType == null) return "CAR";
        String v = vehicleType.trim().toUpperCase();
        if (v.contains("BIKE") || v.contains("MOTOR")) return "BIKE";
        return "CAR";
    }
}