package com.autowashpro.service.impl;

import com.autowashpro.dto.response.CreditLotResponse;
import com.autowashpro.dto.response.CustomerExpiryResultResponse;
import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.entity.PointTransaction;
import com.autowashpro.entity.PointTransactionAllocation;
import com.autowashpro.repository.CustomerLoyaltyRepository;
import com.autowashpro.repository.PointTransactionAllocationRepository;
import com.autowashpro.repository.PointTransactionRepository;
import com.autowashpro.service.LoyaltyPointExpiryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class LoyaltyPointExpiryServiceImpl implements LoyaltyPointExpiryService {

    private final CustomerLoyaltyRepository customerLoyaltyRepository;
    private final PointTransactionRepository pointTransactionRepository;
    private final PointTransactionAllocationRepository allocationRepository;
    private final Clock clock;

    @Value("${loyalty.points.expiry-months:6}")
    private int expiryMonths;

    @Value("${loyalty.points.expiring-soon-days:30}")
    private int expiringSoonDays;

    // ── Expire ───────────────────────────────────────────────────────────────

    /**
     * Core expire logic. Runs inside the caller's transaction.
     * Returns null if no loyalty record exists (no-op case).
     */
    private CustomerExpiryResultResponse doExpire(Long customerId, LocalDateTime now) {
        CustomerLoyalty loyalty = customerLoyaltyRepository
                .findByCustomerIdWithLock(customerId)
                .orElse(null);
        if (loyalty == null) return null;

        int availBefore  = loyalty.getAvailablePoints();
        int expiredBefore = loyalty.getExpiredPoints();

        List<PointTransaction> expiredLots = pointTransactionRepository
                .findExpiredCreditLots(customerId, now);

        int totalLotsExpired = 0;
        int totalPointsExpired = 0;

        for (PointTransaction lot : expiredLots) {
            int toExpire = lot.getRemainingPoints();
            if (toExpire <= 0) continue;

            if (toExpire > loyalty.getAvailablePoints()) {
                log.error("[EXPIRY] Ledger inconsistency for customer {}: lot #{} has remainingPoints={} "
                        + "but availablePoints={}. Capping expiry at availablePoints.",
                        customerId, lot.getId(), toExpire, loyalty.getAvailablePoints());
                toExpire = loyalty.getAvailablePoints();
                if (toExpire <= 0) break;
            }

            lot.setRemainingPoints(0);
            pointTransactionRepository.save(lot);

            PointTransaction expireTx = new PointTransaction();
            expireTx.setCustomerId(customerId);
            expireTx.setType("EXPIRE");
            expireTx.setPoints(-toExpire);
            expireTx.setRemainingPoints(0);
            expireTx.setSource("POINT_EXPIRY");
            expireTx.setNote("Expired " + toExpire + " points from lot #" + lot.getId());
            pointTransactionRepository.save(expireTx);

            PointTransactionAllocation alloc = new PointTransactionAllocation();
            alloc.setDebitTransactionId(expireTx.getId());
            alloc.setCreditTransactionId(lot.getId());
            alloc.setAllocatedPoints(toExpire);
            allocationRepository.save(alloc);

            totalLotsExpired++;
            totalPointsExpired += toExpire;
            loyalty.setAvailablePoints(loyalty.getAvailablePoints() - toExpire);
            log.info("[EXPIRY] Customer {} — lot #{} expired {} pts", customerId, lot.getId(), toExpire);
        }

        if (totalPointsExpired > 0) {
            loyalty.setExpiredPoints(loyalty.getExpiredPoints() + totalPointsExpired);
        }
        loyalty.setLastPointExpiryCheckAt(now);
        customerLoyaltyRepository.save(loyalty);

        // Compute next expiry across remaining active lots
        List<PointTransaction> activeLots = pointTransactionRepository
                .findActiveCreditLotsForFifo(customerId, now);
        LocalDateTime nextExpiryAt = null;
        int nextExpiringPoints = 0;
        for (PointTransaction lot : activeLots) {
            if (lot.getExpiredAt() == null) continue;
            if (nextExpiryAt == null) {
                nextExpiryAt = lot.getExpiredAt();
                nextExpiringPoints = lot.getRemainingPoints();
            } else if (lot.getExpiredAt().isEqual(nextExpiryAt)) {
                nextExpiringPoints += lot.getRemainingPoints();
            } else {
                break;
            }
        }

        boolean changed = totalLotsExpired > 0;
        return CustomerExpiryResultResponse.builder()
                .customerId(customerId)
                .checkedAt(now)
                .availablePointsBefore(availBefore)
                .availablePointsAfter(loyalty.getAvailablePoints())
                .expiredPointsBefore(expiredBefore)
                .expiredPointsAfter(loyalty.getExpiredPoints())
                .lotsExpired(totalLotsExpired)
                .pointsExpired(totalPointsExpired)
                .nextExpiringPoints(nextExpiryAt != null ? nextExpiringPoints : null)
                .nextExpiryAt(nextExpiryAt)
                .lastExpiryCheckAt(now)
                .changed(changed)
                .message(changed
                        ? "Expired " + totalPointsExpired + " points from " + totalLotsExpired + " lot(s)."
                        : "No expired points found for this customer.")
                .build();
    }

    @Override
    @Transactional
    public CustomerExpiryResultResponse expireForCustomer(Long customerId) {
        LocalDateTime now = LocalDateTime.now(clock);
        CustomerExpiryResultResponse result = doExpire(customerId, now);
        if (result == null) {
            // No loyalty record — return zero result, no exception (lazy-expiry no-op)
            return CustomerExpiryResultResponse.builder()
                    .customerId(customerId)
                    .checkedAt(now)
                    .lotsExpired(0)
                    .pointsExpired(0)
                    .changed(false)
                    .message("No loyalty record found for customer " + customerId)
                    .build();
        }
        return result;
    }

    @Override
    @Transactional
    public CustomerExpiryResultResponse expireForCustomerAdmin(Long customerId) {
        LocalDateTime now = LocalDateTime.now(clock);
        CustomerExpiryResultResponse result = doExpire(customerId, now);
        if (result == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "No loyalty record found for customer " + customerId);
        }
        return result;
    }

    // ── FIFO Consume ─────────────────────────────────────────────────────────

    @Override
    @Transactional
    public void consumePointsFifo(Long customerId, int points, Long bookingId) {
        String note = "Redeemed " + points + " points" +
                (bookingId != null ? " for booking #" + bookingId : "");
        consumePointsFifoWithType(customerId, points, bookingId, "REDEEM", "BOOKING_REDEEM", note);
    }

    @Override
    @Transactional
    public void consumePointsFifoWithType(Long customerId, int points, Long bookingId,
                                          String txType, String source, String note) {
        if (points <= 0) return;

        expireForCustomer(customerId);

        CustomerLoyalty loyalty = customerLoyaltyRepository
                .findByCustomerIdWithLock(customerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Loyalty record not found for customer " + customerId));

        if (loyalty.getAvailablePoints() < points) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Insufficient available points: have " + loyalty.getAvailablePoints() + ", need " + points);
        }

        LocalDateTime now = LocalDateTime.now(clock);
        List<PointTransaction> lots = pointTransactionRepository
                .findActiveCreditLotsForFifo(customerId, now);

        PointTransaction debitTx = new PointTransaction();
        debitTx.setCustomerId(customerId);
        debitTx.setBookingId(bookingId);
        debitTx.setType(txType);
        debitTx.setPoints(-points);
        debitTx.setRemainingPoints(0);
        debitTx.setSource(source);
        debitTx.setNote(note);
        debitTx = pointTransactionRepository.save(debitTx);

        int remaining = points;
        for (PointTransaction lot : lots) {
            if (remaining <= 0) break;

            int consume = Math.min(lot.getRemainingPoints(), remaining);
            lot.setRemainingPoints(lot.getRemainingPoints() - consume);
            pointTransactionRepository.save(lot);

            PointTransactionAllocation alloc = new PointTransactionAllocation();
            alloc.setDebitTransactionId(debitTx.getId());
            alloc.setCreditTransactionId(lot.getId());
            alloc.setAllocatedPoints(consume);
            allocationRepository.save(alloc);

            remaining -= consume;
        }

        if (remaining > 0) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Point consumption inconsistency: " + remaining + " points unaccounted");
        }

        loyalty.setAvailablePoints(loyalty.getAvailablePoints() - points);
        loyalty.setRedeemedPoints(loyalty.getRedeemedPoints() + points);
        customerLoyaltyRepository.save(loyalty);

        log.info("[CONSUME] Customer {} — {} pts consumed via {} (booking #{})",
                customerId, points, source, bookingId);
    }

    // ── Allocation-aware Refund ───────────────────────────────────────────────

    @Override
    @Transactional
    public void refundByAllocation(Long bookingId) {
        PointTransaction redeemTx = pointTransactionRepository
                .findByBookingIdAndType(bookingId, "REDEEM")
                .orElse(null);

        if (redeemTx == null) return;

        if (pointTransactionRepository.findByBookingIdAndType(bookingId, "REFUND").isPresent()) {
            return;
        }

        Long customerId = redeemTx.getCustomerId();
        int totalToRefund = Math.abs(redeemTx.getPoints());
        if (totalToRefund <= 0) return;

        CustomerLoyalty loyalty = customerLoyaltyRepository
                .findByCustomerIdWithLock(customerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Loyalty record not found for customer " + customerId));

        List<PointTransactionAllocation> allocations = allocationRepository
                .findByDebitTransactionId(redeemTx.getId());

        LocalDateTime now = LocalDateTime.now(clock);

        int restoredToAvailable = 0;
        int sentToExpired = 0;

        if (allocations.isEmpty()) {
            sentToExpired = totalToRefund;
            log.info("[REFUND] Customer {} booking #{} — legacy REDEEM, {} pts treated as expired "
                    + "(no allocation records)", customerId, bookingId, totalToRefund);
        } else {
            for (PointTransactionAllocation alloc : allocations) {
                PointTransaction creditLot = pointTransactionRepository
                        .findById(alloc.getCreditTransactionId())
                        .orElse(null);

                boolean lotIsValid = creditLot != null
                        && (creditLot.getExpiredAt() == null || creditLot.getExpiredAt().isAfter(now));

                if (lotIsValid) {
                    creditLot.setRemainingPoints(creditLot.getRemainingPoints() + alloc.getAllocatedPoints());
                    pointTransactionRepository.save(creditLot);
                    restoredToAvailable += alloc.getAllocatedPoints();
                } else {
                    sentToExpired += alloc.getAllocatedPoints();
                    log.info("[REFUND] Customer {} — lot #{} expired, {} pts sent to expiredPoints",
                            customerId,
                            creditLot != null ? creditLot.getId() : alloc.getCreditTransactionId(),
                            alloc.getAllocatedPoints());
                }
            }
        }

        PointTransaction refundRecord = new PointTransaction();
        refundRecord.setCustomerId(customerId);
        refundRecord.setBookingId(bookingId);
        refundRecord.setType("REFUND");
        refundRecord.setPoints(totalToRefund);
        refundRecord.setRemainingPoints(0);
        refundRecord.setSource("BOOKING_REFUND");
        String noteDetails = restoredToAvailable > 0 ? restoredToAvailable + " pts restored to original lot" : "";
        if (sentToExpired > 0) {
            if (!noteDetails.isEmpty()) noteDetails += "; ";
            noteDetails += sentToExpired + " pts expired (original lot already expired)";
        }
        refundRecord.setNote("Refunded " + totalToRefund + " pts from booking #" + bookingId
                + (noteDetails.isEmpty() ? "" : " — " + noteDetails));
        pointTransactionRepository.save(refundRecord);

        loyalty.setAvailablePoints(loyalty.getAvailablePoints() + restoredToAvailable);
        loyalty.setExpiredPoints(loyalty.getExpiredPoints() + sentToExpired);
        loyalty.setRedeemedPoints(Math.max(0, loyalty.getRedeemedPoints() - totalToRefund));
        customerLoyaltyRepository.save(loyalty);

        log.info("[REFUND] Customer {} — booking #{}: {} pts → available, {} pts → expired",
                customerId, bookingId, restoredToAvailable, sentToExpired);
    }

    // ── Admin: Credit Lots ────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Page<CreditLotResponse> getCreditLots(Long customerId, int page, int limit,
                                                  String status, Integer expiringWithinDays, String type) {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime expiringSoonThreshold = now.plusDays(expiringSoonDays);

        String typeFilter = (type != null && !type.isBlank()) ? type : null;
        List<PointTransaction> all = pointTransactionRepository.findAllCreditLotsByCustomer(customerId)
                .stream()
                .filter(lot -> typeFilter == null || typeFilter.equalsIgnoreCase(lot.getType()))
                .collect(Collectors.toList());

        List<CreditLotResponse> mapped = all.stream()
                .map(lot -> toCreditLotResponse(lot, now, expiringSoonThreshold))
                .collect(Collectors.toList());

        String statusFilter = (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status))
                ? status.toUpperCase() : null;
        if (statusFilter != null) {
            final String sf = statusFilter;
            mapped = mapped.stream()
                    .filter(r -> sf.equals(r.getStatus()))
                    .collect(Collectors.toList());
        }

        if (expiringWithinDays != null && expiringWithinDays > 0) {
            LocalDateTime threshold = now.plusDays(expiringWithinDays);
            mapped = mapped.stream()
                    .filter(r -> r.getExpiredAt() != null
                            && r.getExpiredAt().isAfter(now)
                            && !r.getExpiredAt().isAfter(threshold)
                            && r.getRemainingPoints() > 0)
                    .collect(Collectors.toList());
        }

        int from = Math.max(0, (page - 1) * limit);
        int to = Math.min(from + limit, mapped.size());
        List<CreditLotResponse> pageContent = from >= mapped.size()
                ? new ArrayList<>()
                : mapped.subList(from, to);

        return new PageImpl<>(pageContent, PageRequest.of(page - 1, limit), mapped.size());
    }

    // ── Admin: Extend Expiry ──────────────────────────────────────────────────

    @Override
    @Transactional
    public void extendLotExpiry(Long lotId, LocalDateTime newExpiredAt, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reason is required");
        }

        PointTransaction lot = pointTransactionRepository.findById(lotId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Credit lot #" + lotId + " not found"));

        if (lot.getPoints() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Transaction #" + lotId + " is not a credit lot (points <= 0)");
        }

        if (lot.getRemainingPoints() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Credit lot #" + lotId + " is fully consumed; expiry cannot be extended");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        if (newExpiredAt == null || !newExpiredAt.isAfter(now)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "newExpiredAt must be a future date");
        }

        String oldExpiry = lot.getExpiredAt() != null ? lot.getExpiredAt().toString() : "null";
        lot.setNote((lot.getNote() != null ? lot.getNote() + " | " : "") +
                "Expiry extended from " + oldExpiry + " to " + newExpiredAt + ": " + reason.trim());
        lot.setExpiredAt(newExpiredAt);
        pointTransactionRepository.save(lot);

        log.info("[EXTEND_EXPIRY] Lot #{} extended from {} to {} (reason: {})",
                lotId, oldExpiry, newExpiredAt, reason);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private CreditLotResponse toCreditLotResponse(PointTransaction lot,
                                                   LocalDateTime now,
                                                   LocalDateTime expiringSoonThreshold) {
        boolean isExpired = lot.getExpiredAt() != null && !lot.getExpiredAt().isAfter(now);
        boolean isFullyConsumed = lot.getRemainingPoints() <= 0;
        boolean isExpiringSoon = !isExpired && !isFullyConsumed
                && lot.getExpiredAt() != null
                && !lot.getExpiredAt().isAfter(expiringSoonThreshold);

        String status;
        if (isFullyConsumed && !isExpired) {
            status = "CONSUMED";
        } else if (isExpired) {
            status = "EXPIRED";
        } else if (isExpiringSoon) {
            status = "EXPIRING_SOON";
        } else {
            status = "ACTIVE";
        }

        return CreditLotResponse.builder()
                .id(lot.getId())
                .customerId(lot.getCustomerId())
                .type(lot.getType())
                .source(lot.getSource())
                .bookingId(lot.getBookingId())
                .totalPoints(lot.getPoints())
                .remainingPoints(lot.getRemainingPoints())
                .consumedPoints(lot.getPoints() - lot.getRemainingPoints())
                .createdAt(lot.getCreatedAt())
                .expiredAt(lot.getExpiredAt())
                .status(status)
                .note(lot.getNote())
                .expired(isExpired)
                .fullyConsumed(isFullyConsumed)
                .build();
    }
}
