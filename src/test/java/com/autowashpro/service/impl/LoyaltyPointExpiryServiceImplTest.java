package com.autowashpro.service.impl;

import com.autowashpro.dto.response.CreditLotResponse;
import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.entity.PointTransaction;
import com.autowashpro.entity.PointTransactionAllocation;
import com.autowashpro.repository.CustomerLoyaltyRepository;
import com.autowashpro.repository.PointTransactionAllocationRepository;
import com.autowashpro.repository.PointTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LoyaltyPointExpiryServiceImplTest {

    @Mock private CustomerLoyaltyRepository customerLoyaltyRepository;
    @Mock private PointTransactionRepository pointTransactionRepository;
    @Mock private PointTransactionAllocationRepository allocationRepository;

    /** Fixed clock — avoids Spy issues with final FixedClock class. */
    private final Clock clock = Clock.fixed(Instant.parse("2026-07-19T00:00:00Z"), ZoneOffset.UTC);

    private LoyaltyPointExpiryServiceImpl service;

    private static final Long CUSTOMER_ID = 1L;
    private static final int EXPIRY_MONTHS = 6;

    /** Fixed "now" matching the clock above. */
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 7, 19, 0, 0, 0);

    @BeforeEach
    void setUp() {
        service = new LoyaltyPointExpiryServiceImpl(
                customerLoyaltyRepository, pointTransactionRepository, allocationRepository, clock);
        ReflectionTestUtils.setField(service, "expiryMonths", EXPIRY_MONTHS);
        ReflectionTestUtils.setField(service, "expiringSoonDays", 30);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private CustomerLoyalty loyalty(int available, int expired) {
        CustomerLoyalty cl = new CustomerLoyalty();
        cl.setId(10L);
        cl.setCustomerId(CUSTOMER_ID);
        cl.setAvailablePoints(available);
        cl.setExpiredPoints(expired);
        cl.setRedeemedPoints(0);
        cl.setTotalPoints(available + expired);
        return cl;
    }

    private PointTransaction creditLot(Long id, int points, int remaining, LocalDateTime expiredAt) {
        PointTransaction pt = new PointTransaction();
        pt.setId(id);
        pt.setCustomerId(CUSTOMER_ID);
        pt.setType("EARN");
        pt.setPoints(points);
        pt.setRemainingPoints(remaining);
        pt.setExpiredAt(expiredAt);
        pt.setSource("BOOKING_EARN");
        return pt;
    }

    // ══════════════════════════════════════════════════════════════════
    // expireForCustomer
    // ══════════════════════════════════════════════════════════════════

    @Test
    void expireForCustomer_noLoyaltyRecord_doesNothing() {
        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.empty());

        service.expireForCustomer(CUSTOMER_ID);

        verify(pointTransactionRepository, never()).findExpiredCreditLots(any(), any());
        verify(pointTransactionRepository, never()).save(any());
    }

    @Test
    void expireForCustomer_noExpiredLots_updatesLastCheckAt() {
        CustomerLoyalty cl = loyalty(100, 0);
        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(Collections.emptyList());

        service.expireForCustomer(CUSTOMER_ID);

        assertNotNull(cl.getLastPointExpiryCheckAt());
        verify(customerLoyaltyRepository).save(cl);
        verify(pointTransactionRepository, never()).save(any(PointTransaction.class));
    }

    @Test
    void expireForCustomer_singleExpiredLot_createsExpireTransactionWithCorrectSource() {
        CustomerLoyalty cl = loyalty(100, 0);
        PointTransaction lot = creditLot(1L, 100, 100, NOW.minusDays(1));

        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(List.of(lot));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> {
            PointTransaction tx = inv.getArgument(0);
            if (tx.getId() == null) tx.setId(99L);
            return tx;
        });

        service.expireForCustomer(CUSTOMER_ID);

        assertEquals(0, lot.getRemainingPoints());

        ArgumentCaptor<PointTransaction> txCaptor = ArgumentCaptor.forClass(PointTransaction.class);
        verify(pointTransactionRepository, atLeastOnce()).save(txCaptor.capture());
        PointTransaction expireTx = txCaptor.getAllValues().stream()
                .filter(t -> "EXPIRE".equals(t.getType())).findFirst().orElseThrow();
        assertEquals(-100, expireTx.getPoints());
        // source must be POINT_EXPIRY (not LOT_EXPIRE)
        assertEquals("POINT_EXPIRY", expireTx.getSource());

        assertEquals(0, cl.getAvailablePoints());
        assertEquals(100, cl.getExpiredPoints());
    }

    @Test
    void expireForCustomer_partiallyConsumedLot_expiresOnlyRemainingPoints() {
        CustomerLoyalty cl = loyalty(40, 0);
        PointTransaction lot = creditLot(2L, 100, 40, NOW.minusHours(1));

        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(List.of(lot));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> {
            PointTransaction tx = inv.getArgument(0);
            if (tx.getId() == null) tx.setId(99L);
            return tx;
        });

        service.expireForCustomer(CUSTOMER_ID);

        ArgumentCaptor<PointTransaction> captor = ArgumentCaptor.forClass(PointTransaction.class);
        verify(pointTransactionRepository, atLeastOnce()).save(captor.capture());
        PointTransaction expireTx = captor.getAllValues().stream()
                .filter(t -> "EXPIRE".equals(t.getType())).findFirst().orElseThrow();
        assertEquals(-40, expireTx.getPoints());
        assertEquals(0, cl.getAvailablePoints());
        assertEquals(40, cl.getExpiredPoints());
    }

    @Test
    void expireForCustomer_multipleExpiredLots_allExpired() {
        CustomerLoyalty cl = loyalty(150, 0);
        PointTransaction lot1 = creditLot(1L, 100, 80, NOW.minusDays(1));
        PointTransaction lot2 = creditLot(2L, 70, 70, NOW.minusDays(2));

        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(List.of(lot1, lot2));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> {
            PointTransaction tx = inv.getArgument(0);
            if (tx.getId() == null) tx.setId(99L);
            return tx;
        });

        service.expireForCustomer(CUSTOMER_ID);

        assertEquals(0, cl.getAvailablePoints());
        assertEquals(150, cl.getExpiredPoints()); // 80 + 70
        assertEquals(0, lot1.getRemainingPoints());
        assertEquals(0, lot2.getRemainingPoints());
    }

    @Test
    void expireForCustomer_lotWithNullExpiredAt_notIncluded() {
        CustomerLoyalty cl = loyalty(100, 0);
        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        // findExpiredCreditLots only returns lots where expiredAt <= now, null is excluded
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(Collections.emptyList());

        service.expireForCustomer(CUSTOMER_ID);

        assertEquals(100, cl.getAvailablePoints());
        assertEquals(0, cl.getExpiredPoints());
    }

    @Test
    void expireForCustomer_createsAllocationLinkingExpireTxToLot() {
        CustomerLoyalty cl = loyalty(50, 0);
        PointTransaction lot = creditLot(5L, 50, 50, NOW.minusDays(1));

        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(List.of(lot));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> {
            PointTransaction tx = inv.getArgument(0);
            if (tx.getId() == null) tx.setId(99L);
            return tx;
        });

        service.expireForCustomer(CUSTOMER_ID);

        ArgumentCaptor<PointTransactionAllocation> allocCaptor =
                ArgumentCaptor.forClass(PointTransactionAllocation.class);
        verify(allocationRepository).save(allocCaptor.capture());
        PointTransactionAllocation alloc = allocCaptor.getValue();
        assertEquals(99L, alloc.getDebitTransactionId());
        assertEquals(5L, alloc.getCreditTransactionId());
        assertEquals(50, alloc.getAllocatedPoints());
    }

    @Test
    void expireForCustomer_neverExpireMoreThanAvailablePoints() {
        // Ledger inconsistency: lot claims 100 remaining but only 40 available
        CustomerLoyalty cl = loyalty(40, 0);
        PointTransaction lot = creditLot(1L, 100, 100, NOW.minusDays(1));

        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(List.of(lot));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> {
            PointTransaction tx = inv.getArgument(0);
            if (tx.getId() == null) tx.setId(99L);
            return tx;
        });

        service.expireForCustomer(CUSTOMER_ID);

        // Should cap at 40, not expire 100
        assertEquals(40, cl.getExpiredPoints());
        assertEquals(0, cl.getAvailablePoints());
    }

    // ══════════════════════════════════════════════════════════════════
    // consumePointsFifo
    // ══════════════════════════════════════════════════════════════════

    @Test
    void consumePointsFifo_zeroPoints_doesNothing() {
        service.consumePointsFifo(CUSTOMER_ID, 0, 1L);

        verifyNoInteractions(customerLoyaltyRepository, pointTransactionRepository, allocationRepository);
    }

    @Test
    void consumePointsFifo_insufficientPoints_throwsBadRequest() {
        CustomerLoyalty cl = loyalty(30, 0);
        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(Collections.emptyList());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.consumePointsFifo(CUSTOMER_ID, 50, 1L));
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void consumePointsFifo_customerNotFound_throwsNotFound() {
        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class,
                () -> service.consumePointsFifo(CUSTOMER_ID, 50, 1L));
    }

    @Test
    void consumePointsFifo_singleLotCoversFullAmount_createsRedeemAndAllocation() {
        CustomerLoyalty cl = loyalty(100, 0);
        PointTransaction lot = creditLot(3L, 100, 100, NOW.plusMonths(6));

        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(Collections.emptyList());
        when(pointTransactionRepository.findActiveCreditLotsForFifo(eq(CUSTOMER_ID), any()))
                .thenReturn(List.of(lot));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> {
            PointTransaction tx = inv.getArgument(0);
            if (tx.getId() == null) tx.setId(200L);
            return tx;
        });

        service.consumePointsFifo(CUSTOMER_ID, 50, 7L);

        assertEquals(50, lot.getRemainingPoints());
        assertEquals(50, cl.getAvailablePoints());
        assertEquals(50, cl.getRedeemedPoints());

        ArgumentCaptor<PointTransactionAllocation> allocCaptor =
                ArgumentCaptor.forClass(PointTransactionAllocation.class);
        verify(allocationRepository).save(allocCaptor.capture());
        PointTransactionAllocation alloc = allocCaptor.getValue();
        assertEquals(200L, alloc.getDebitTransactionId());
        assertEquals(3L, alloc.getCreditTransactionId());
        assertEquals(50, alloc.getAllocatedPoints());
    }

    @Test
    void consumePointsFifo_multipleLotsNeeded_fifoConsumedInExpiryOrder() {
        CustomerLoyalty cl = loyalty(150, 0);
        PointTransaction lot1 = creditLot(1L, 80, 80, NOW.plusDays(10));
        PointTransaction lot2 = creditLot(2L, 70, 70, NOW.plusMonths(5));

        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(Collections.emptyList());
        when(pointTransactionRepository.findActiveCreditLotsForFifo(eq(CUSTOMER_ID), any()))
                .thenReturn(List.of(lot1, lot2));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> {
            PointTransaction tx = inv.getArgument(0);
            if (tx.getId() == null) tx.setId(300L);
            return tx;
        });

        service.consumePointsFifo(CUSTOMER_ID, 100, 8L);

        assertEquals(0, lot1.getRemainingPoints());
        assertEquals(50, lot2.getRemainingPoints());

        ArgumentCaptor<PointTransactionAllocation> captor =
                ArgumentCaptor.forClass(PointTransactionAllocation.class);
        verify(allocationRepository, times(2)).save(captor.capture());
        List<PointTransactionAllocation> allocs = captor.getAllValues();
        assertEquals(80, allocs.get(0).getAllocatedPoints());
        assertEquals(20, allocs.get(1).getAllocatedPoints());
    }

    @Test
    void consumePointsFifo_redeemTxHasCorrectBookingId() {
        CustomerLoyalty cl = loyalty(50, 0);
        PointTransaction lot = creditLot(4L, 50, 50, NOW.plusMonths(6));

        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(Collections.emptyList());
        when(pointTransactionRepository.findActiveCreditLotsForFifo(eq(CUSTOMER_ID), any()))
                .thenReturn(List.of(lot));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> {
            PointTransaction tx = inv.getArgument(0);
            if (tx.getId() == null) tx.setId(400L);
            return tx;
        });

        service.consumePointsFifo(CUSTOMER_ID, 30, 42L);

        ArgumentCaptor<PointTransaction> txCaptor = ArgumentCaptor.forClass(PointTransaction.class);
        verify(pointTransactionRepository, atLeastOnce()).save(txCaptor.capture());
        PointTransaction redeemTx = txCaptor.getAllValues().stream()
                .filter(t -> "REDEEM".equals(t.getType())).findFirst().orElseThrow();
        assertEquals(42L, redeemTx.getBookingId());
        assertEquals(-30, redeemTx.getPoints());
        assertEquals("BOOKING_REDEEM", redeemTx.getSource());
    }

    @Test
    void consumePointsFifo_nullBookingId_noBookingIdOnRedeemTx() {
        CustomerLoyalty cl = loyalty(20, 0);
        PointTransaction lot = creditLot(5L, 20, 20, NOW.plusMonths(3));

        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(Collections.emptyList());
        when(pointTransactionRepository.findActiveCreditLotsForFifo(eq(CUSTOMER_ID), any()))
                .thenReturn(List.of(lot));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> {
            PointTransaction tx = inv.getArgument(0);
            if (tx.getId() == null) tx.setId(500L);
            return tx;
        });

        service.consumePointsFifo(CUSTOMER_ID, 20, null);

        ArgumentCaptor<PointTransaction> txCaptor = ArgumentCaptor.forClass(PointTransaction.class);
        verify(pointTransactionRepository, atLeastOnce()).save(txCaptor.capture());
        PointTransaction redeemTx = txCaptor.getAllValues().stream()
                .filter(t -> "REDEEM".equals(t.getType())).findFirst().orElseThrow();
        assertNull(redeemTx.getBookingId());
    }

    @Test
    void consumePointsFifoWithType_usesCustomTypeAndSource() {
        CustomerLoyalty cl = loyalty(50, 0);
        PointTransaction lot = creditLot(6L, 50, 50, NOW.plusMonths(6));

        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(Collections.emptyList());
        when(pointTransactionRepository.findActiveCreditLotsForFifo(eq(CUSTOMER_ID), any()))
                .thenReturn(List.of(lot));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> {
            PointTransaction tx = inv.getArgument(0);
            if (tx.getId() == null) tx.setId(600L);
            return tx;
        });

        service.consumePointsFifoWithType(CUSTOMER_ID, 25, null, "ADMIN_ADJUST", "ADMIN_ADJUST", "Manual deduction");

        ArgumentCaptor<PointTransaction> txCaptor = ArgumentCaptor.forClass(PointTransaction.class);
        verify(pointTransactionRepository, atLeastOnce()).save(txCaptor.capture());
        PointTransaction debitTx = txCaptor.getAllValues().stream()
                .filter(t -> "ADMIN_ADJUST".equals(t.getType())).findFirst().orElseThrow();
        assertEquals("ADMIN_ADJUST", debitTx.getSource());
        assertEquals("Manual deduction", debitTx.getNote());
        assertEquals(-25, debitTx.getPoints());
    }

    @Test
    void consumePointsFifo_runsLazyExpiryBeforeConsuming() {
        CustomerLoyalty cl = loyalty(100, 0);
        PointTransaction lot = creditLot(7L, 100, 100, NOW.plusMonths(6));

        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(Collections.emptyList());
        when(pointTransactionRepository.findActiveCreditLotsForFifo(eq(CUSTOMER_ID), any()))
                .thenReturn(List.of(lot));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> {
            PointTransaction tx = inv.getArgument(0);
            if (tx.getId() == null) tx.setId(700L);
            return tx;
        });

        service.consumePointsFifo(CUSTOMER_ID, 10, null);

        verify(pointTransactionRepository).findExpiredCreditLots(eq(CUSTOMER_ID), any());
    }

    // ══════════════════════════════════════════════════════════════════
    // refundByAllocation — new business rules
    // ══════════════════════════════════════════════════════════════════

    @Test
    void refundByAllocation_noRedeemTx_doesNothing() {
        when(pointTransactionRepository.findByBookingIdAndType(1L, "REDEEM"))
                .thenReturn(Optional.empty());

        service.refundByAllocation(1L);

        verifyNoInteractions(customerLoyaltyRepository, allocationRepository);
        verify(pointTransactionRepository, never()).save(any());
    }

    @Test
    void refundByAllocation_alreadyRefunded_doesNothing() {
        PointTransaction redeemTx = new PointTransaction();
        redeemTx.setId(10L);
        redeemTx.setCustomerId(CUSTOMER_ID);
        redeemTx.setPoints(-50);
        when(pointTransactionRepository.findByBookingIdAndType(5L, "REDEEM"))
                .thenReturn(Optional.of(redeemTx));
        when(pointTransactionRepository.findByBookingIdAndType(5L, "REFUND"))
                .thenReturn(Optional.of(new PointTransaction())); // already refunded

        service.refundByAllocation(5L);

        verifyNoInteractions(customerLoyaltyRepository);
        verify(allocationRepository, never()).findByDebitTransactionId(any());
    }

    @Test
    void refundByAllocation_withAllocations_validLot_restoresRemainingPoints() {
        Long bookingId = 10L;
        PointTransaction redeemTx = redeemTx(20L, -80);
        PointTransaction creditLot = creditLot(5L, 100, 20, NOW.plusMonths(4)); // still valid

        PointTransactionAllocation alloc = alloc(20L, 5L, 80);

        CustomerLoyalty cl = loyalty(0, 0);
        cl.setRedeemedPoints(80);

        setupRefundMocks(bookingId, redeemTx, List.of(alloc), List.of(creditLot), cl);

        service.refundByAllocation(bookingId);

        // credit lot restored in-place, no new credit lot created
        assertEquals(100, creditLot.getRemainingPoints()); // 20 + 80

        // availablePoints increased by restored amount
        assertEquals(80, cl.getAvailablePoints());
        // expiredPoints unchanged
        assertEquals(0, cl.getExpiredPoints());
        // redeemedPoints decreased
        assertEquals(0, cl.getRedeemedPoints());
    }

    @Test
    void refundByAllocation_validLot_doesNotChangeExpiredAt() {
        Long bookingId = 30L;
        LocalDateTime originalExpiry = NOW.plusMonths(4);
        PointTransaction redeemTx = redeemTx(31L, -50);
        PointTransaction creditLot = creditLot(10L, 100, 50, originalExpiry);

        PointTransactionAllocation alloc = alloc(31L, 10L, 50);
        CustomerLoyalty cl = loyalty(0, 0);
        cl.setRedeemedPoints(50);

        setupRefundMocks(bookingId, redeemTx, List.of(alloc), List.of(creditLot), cl);

        service.refundByAllocation(bookingId);

        // expiredAt must not be changed
        assertEquals(originalExpiry, creditLot.getExpiredAt());
    }

    @Test
    void refundByAllocation_expiredLot_addsToExpiredPointsNotAvailable() {
        Long bookingId = 11L;
        PointTransaction redeemTx = redeemTx(21L, -60);
        PointTransaction expiredLot = creditLot(6L, 60, 0, NOW.minusDays(1)); // expired

        PointTransactionAllocation alloc = alloc(21L, 6L, 60);
        CustomerLoyalty cl = loyalty(0, 0);
        cl.setRedeemedPoints(60);

        setupRefundMocks(bookingId, redeemTx, List.of(alloc), List.of(expiredLot), cl);

        service.refundByAllocation(bookingId);

        // availablePoints must NOT increase (lot is expired)
        assertEquals(0, cl.getAvailablePoints());
        // expiredPoints must increase
        assertEquals(60, cl.getExpiredPoints());
        // redeemedPoints decreases
        assertEquals(0, cl.getRedeemedPoints());
    }

    @Test
    void refundByAllocation_expiredLot_doesNotCreateNewCreditLot() {
        Long bookingId = 11L;
        PointTransaction redeemTx = redeemTx(21L, -60);
        PointTransaction expiredLot = creditLot(6L, 60, 0, NOW.minusDays(1));

        PointTransactionAllocation alloc = alloc(21L, 6L, 60);
        CustomerLoyalty cl = loyalty(0, 0);
        cl.setRedeemedPoints(60);

        setupRefundMocks(bookingId, redeemTx, List.of(alloc), List.of(expiredLot), cl);

        service.refundByAllocation(bookingId);

        // Only the REFUND summary transaction should be saved (remainingPoints = 0)
        ArgumentCaptor<PointTransaction> txCaptor = ArgumentCaptor.forClass(PointTransaction.class);
        verify(pointTransactionRepository, atLeastOnce()).save(txCaptor.capture());
        long creditLotsCreated = txCaptor.getAllValues().stream()
                .filter(t -> "REFUND".equals(t.getType()) && t.getRemainingPoints() != null && t.getRemainingPoints() > 0)
                .count();
        assertEquals(0, creditLotsCreated, "No new REFUND credit lot should be created for expired lot");
    }

    @Test
    void refundByAllocation_expiredLot_createsRefundAuditTransaction() {
        Long bookingId = 11L;
        PointTransaction redeemTx = redeemTx(21L, -60);
        PointTransaction expiredLot = creditLot(6L, 60, 0, NOW.minusDays(1));

        PointTransactionAllocation alloc = alloc(21L, 6L, 60);
        CustomerLoyalty cl = loyalty(0, 0);
        cl.setRedeemedPoints(60);

        setupRefundMocks(bookingId, redeemTx, List.of(alloc), List.of(expiredLot), cl);

        service.refundByAllocation(bookingId);

        ArgumentCaptor<PointTransaction> txCaptor = ArgumentCaptor.forClass(PointTransaction.class);
        verify(pointTransactionRepository, atLeastOnce()).save(txCaptor.capture());
        PointTransaction auditRefund = txCaptor.getAllValues().stream()
                .filter(t -> "REFUND".equals(t.getType())).findFirst().orElseThrow();
        assertEquals("BOOKING_REFUND", auditRefund.getSource());
        assertEquals(60, auditRefund.getPoints());   // positive — total refunded from booking
        assertEquals(0, auditRefund.getRemainingPoints()); // audit row, not a credit lot
    }

    @Test
    void refundByAllocation_noAllocations_legacy_treatsAllAsExpired() {
        Long bookingId = 12L;
        PointTransaction redeemTx = redeemTx(22L, -40);
        CustomerLoyalty cl = loyalty(10, 0);
        cl.setRedeemedPoints(40);

        when(pointTransactionRepository.findByBookingIdAndType(bookingId, "REDEEM"))
                .thenReturn(Optional.of(redeemTx));
        when(pointTransactionRepository.findByBookingIdAndType(bookingId, "REFUND"))
                .thenReturn(Optional.empty());
        when(allocationRepository.findByDebitTransactionId(22L))
                .thenReturn(Collections.emptyList()); // no allocations — legacy
        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.refundByAllocation(bookingId);

        // Legacy: cannot trace lots → all treated as expired
        assertEquals(10, cl.getAvailablePoints()); // unchanged
        assertEquals(40, cl.getExpiredPoints());    // increased
        assertEquals(0, cl.getRedeemedPoints());    // decreased
    }

    @Test
    void refundByAllocation_noAllocations_legacy_doesNotCreateCreditLot() {
        Long bookingId = 12L;
        PointTransaction redeemTx = redeemTx(22L, -40);
        CustomerLoyalty cl = loyalty(0, 0);
        cl.setRedeemedPoints(40);

        when(pointTransactionRepository.findByBookingIdAndType(bookingId, "REDEEM"))
                .thenReturn(Optional.of(redeemTx));
        when(pointTransactionRepository.findByBookingIdAndType(bookingId, "REFUND"))
                .thenReturn(Optional.empty());
        when(allocationRepository.findByDebitTransactionId(22L))
                .thenReturn(Collections.emptyList());
        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.refundByAllocation(bookingId);

        ArgumentCaptor<PointTransaction> txCaptor = ArgumentCaptor.forClass(PointTransaction.class);
        verify(pointTransactionRepository, atLeastOnce()).save(txCaptor.capture());
        long newCreditLots = txCaptor.getAllValues().stream()
                .filter(t -> "REFUND".equals(t.getType()) && t.getRemainingPoints() != null && t.getRemainingPoints() > 0)
                .count();
        assertEquals(0, newCreditLots, "No credit lot should be silently created for legacy REDEEM");
    }

    @Test
    void refundByAllocation_idempotent_secondCallDoesNothing() {
        Long bookingId = 25L;
        PointTransaction redeemTx = redeemTx(26L, -30);
        when(pointTransactionRepository.findByBookingIdAndType(bookingId, "REDEEM"))
                .thenReturn(Optional.of(redeemTx));
        when(pointTransactionRepository.findByBookingIdAndType(bookingId, "REFUND"))
                .thenReturn(Optional.of(new PointTransaction())); // already refunded

        service.refundByAllocation(bookingId);

        verifyNoInteractions(customerLoyaltyRepository);
    }

    @Test
    void refundByAllocation_mixedExpiredAndValidLots_correctlyHandlesBoth() {
        Long bookingId = 20L;
        PointTransaction redeemTx = redeemTx(30L, -50);

        PointTransaction validLot   = creditLot(7L, 100, 70, NOW.plusMonths(3));
        PointTransaction expiredLot = creditLot(8L, 30, 10, NOW.minusDays(1));

        PointTransactionAllocation alloc1 = alloc(30L, 7L, 30); // 30 from valid
        PointTransactionAllocation alloc2 = alloc(30L, 8L, 20); // 20 from expired

        CustomerLoyalty cl = loyalty(0, 0);
        cl.setRedeemedPoints(50);

        setupRefundMocks(bookingId, redeemTx, List.of(alloc1, alloc2),
                List.of(validLot, expiredLot), cl);

        service.refundByAllocation(bookingId);

        // valid lot restored (70 + 30 = 100)
        assertEquals(100, validLot.getRemainingPoints());
        // expired part → expiredPoints, not availablePoints
        assertEquals(30, cl.getAvailablePoints()); // only the 30 from valid lot
        assertEquals(20, cl.getExpiredPoints());    // 20 from expired lot
        assertEquals(0, cl.getRedeemedPoints());
    }

    @Test
    void refundByAllocation_zeroRedeemPoints_doesNothing() {
        Long bookingId = 15L;
        PointTransaction redeemTx = redeemTx(25L, 0);

        when(pointTransactionRepository.findByBookingIdAndType(bookingId, "REDEEM"))
                .thenReturn(Optional.of(redeemTx));
        when(pointTransactionRepository.findByBookingIdAndType(bookingId, "REFUND"))
                .thenReturn(Optional.empty());

        service.refundByAllocation(bookingId);

        verifyNoInteractions(customerLoyaltyRepository);
        verify(allocationRepository, never()).findByDebitTransactionId(any());
    }

    // ══════════════════════════════════════════════════════════════════
    // getCreditLots (paginated)
    // ══════════════════════════════════════════════════════════════════

    @Test
    void getCreditLots_returnsAllPositiveTransactions() {
        PointTransaction lot1 = creditLot(1L, 100, 60, NOW.plusMonths(5));
        PointTransaction lot2 = creditLot(2L, 50, 50, NOW.plusMonths(3));

        when(pointTransactionRepository.findAllCreditLotsByCustomer(CUSTOMER_ID))
                .thenReturn(List.of(lot1, lot2));

        Page<CreditLotResponse> result = service.getCreditLots(CUSTOMER_ID, 1, 20, null, null, null);

        assertEquals(2, result.getTotalElements());
    }

    @Test
    void getCreditLots_computesConsumedPointsAndStatus() {
        PointTransaction lot = creditLot(1L, 100, 60, NOW.plusMonths(5));
        when(pointTransactionRepository.findAllCreditLotsByCustomer(CUSTOMER_ID))
                .thenReturn(List.of(lot));

        Page<CreditLotResponse> result = service.getCreditLots(CUSTOMER_ID, 1, 20, null, null, null);
        CreditLotResponse r = result.getContent().get(0);

        assertEquals(40, r.getConsumedPoints()); // 100 - 60
        assertEquals(60, r.getRemainingPoints());
        assertEquals(100, r.getTotalPoints());
        assertEquals("ACTIVE", r.getStatus());
    }

    @Test
    void getCreditLots_statusExpiredCorrect() {
        PointTransaction expiredLot = creditLot(1L, 100, 30, NOW.minusDays(1));
        PointTransaction validLot   = creditLot(2L, 80, 80, NOW.plusMonths(1));

        when(pointTransactionRepository.findAllCreditLotsByCustomer(CUSTOMER_ID))
                .thenReturn(List.of(expiredLot, validLot));

        Page<CreditLotResponse> result = service.getCreditLots(CUSTOMER_ID, 1, 20, null, null, null);

        assertEquals("EXPIRED", result.getContent().stream().filter(r -> r.getId().equals(1L)).findFirst().orElseThrow().getStatus());
        assertEquals("ACTIVE",  result.getContent().stream().filter(r -> r.getId().equals(2L)).findFirst().orElseThrow().getStatus());
    }

    @Test
    void getCreditLots_statusConsumedCorrect() {
        PointTransaction consumed = creditLot(1L, 100, 0, NOW.plusMonths(5));
        PointTransaction partial  = creditLot(2L, 100, 50, NOW.plusMonths(5));

        when(pointTransactionRepository.findAllCreditLotsByCustomer(CUSTOMER_ID))
                .thenReturn(List.of(consumed, partial));

        Page<CreditLotResponse> result = service.getCreditLots(CUSTOMER_ID, 1, 20, null, null, null);

        assertEquals("CONSUMED", result.getContent().stream().filter(r -> r.getId().equals(1L)).findFirst().orElseThrow().getStatus());
        assertEquals("ACTIVE",   result.getContent().stream().filter(r -> r.getId().equals(2L)).findFirst().orElseThrow().getStatus());
    }

    @Test
    void getCreditLots_filterByStatusActive_excludesExpiredAndConsumed() {
        PointTransaction activeLot   = creditLot(1L, 100, 60, NOW.plusMonths(5));
        PointTransaction expiredLot  = creditLot(2L, 100, 30, NOW.minusDays(1));
        PointTransaction consumedLot = creditLot(3L, 100, 0, NOW.plusMonths(5));

        when(pointTransactionRepository.findAllCreditLotsByCustomer(CUSTOMER_ID))
                .thenReturn(List.of(activeLot, expiredLot, consumedLot));

        Page<CreditLotResponse> result = service.getCreditLots(CUSTOMER_ID, 1, 20, "ACTIVE", null, null);

        assertEquals(1, result.getTotalElements());
        assertEquals(1L, result.getContent().get(0).getId());
    }

    @Test
    void getCreditLots_expiringWithinDays_filtersByThreshold() {
        PointTransaction soonLot = creditLot(1L, 100, 50, NOW.plusDays(7));
        PointTransaction farLot  = creditLot(2L, 100, 50, NOW.plusMonths(6));

        when(pointTransactionRepository.findAllCreditLotsByCustomer(CUSTOMER_ID))
                .thenReturn(List.of(soonLot, farLot));

        Page<CreditLotResponse> result = service.getCreditLots(CUSTOMER_ID, 1, 20, null, 30, null);

        assertEquals(1, result.getTotalElements());
        assertEquals(1L, result.getContent().get(0).getId());
    }

    @Test
    void getCreditLots_containsCustomerId() {
        PointTransaction lot = creditLot(1L, 100, 60, NOW.plusMonths(5));
        when(pointTransactionRepository.findAllCreditLotsByCustomer(CUSTOMER_ID))
                .thenReturn(List.of(lot));

        Page<CreditLotResponse> result = service.getCreditLots(CUSTOMER_ID, 1, 20, null, null, null);

        assertEquals(CUSTOMER_ID, result.getContent().get(0).getCustomerId());
    }

    // ══════════════════════════════════════════════════════════════════
    // extendLotExpiry
    // ══════════════════════════════════════════════════════════════════

    @Test
    void extendLotExpiry_validExtension_updatesExpiredAt() {
        PointTransaction lot = creditLot(1L, 100, 50, NOW.plusMonths(1));
        LocalDateTime newExpiry = NOW.plusMonths(12);

        when(pointTransactionRepository.findById(1L)).thenReturn(Optional.of(lot));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.extendLotExpiry(1L, newExpiry, "Customer request");

        assertEquals(newExpiry, lot.getExpiredAt());
        verify(pointTransactionRepository).save(lot);
    }

    @Test
    void extendLotExpiry_lotNotFound_throwsNotFound() {
        when(pointTransactionRepository.findById(99L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.extendLotExpiry(99L, NOW.plusMonths(3), "test"));
        assertEquals(org.springframework.http.HttpStatus.NOT_FOUND, ex.getStatusCode());
    }

    @Test
    void extendLotExpiry_debitTransaction_throwsBadRequest() {
        PointTransaction debitTx = new PointTransaction();
        debitTx.setId(1L);
        debitTx.setPoints(-50);
        when(pointTransactionRepository.findById(1L)).thenReturn(Optional.of(debitTx));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.extendLotExpiry(1L, NOW.plusMonths(3), "test"));
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void extendLotExpiry_fullyConsumedLot_throwsBadRequest() {
        PointTransaction consumed = creditLot(1L, 100, 0, NOW.plusMonths(1));
        when(pointTransactionRepository.findById(1L)).thenReturn(Optional.of(consumed));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.extendLotExpiry(1L, NOW.plusMonths(3), "test"));
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void extendLotExpiry_pastDate_throwsBadRequest() {
        PointTransaction lot = creditLot(1L, 100, 50, NOW.plusMonths(1));
        when(pointTransactionRepository.findById(1L)).thenReturn(Optional.of(lot));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.extendLotExpiry(1L, NOW.minusDays(1), "test"));
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void extendLotExpiry_nullDate_throwsBadRequest() {
        PointTransaction lot = creditLot(1L, 100, 50, NOW.plusMonths(1));
        when(pointTransactionRepository.findById(1L)).thenReturn(Optional.of(lot));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.extendLotExpiry(1L, null, "test"));
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void extendLotExpiry_blankReason_throwsBadRequest() {
        // reason check is first in the impl — findById is never reached, so don't stub it
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.extendLotExpiry(1L, NOW.plusMonths(3), "  "));
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void extendLotExpiry_appendsAuditNoteContainingOldAndNewExpiry() {
        LocalDateTime oldExpiry = NOW.plusMonths(1);
        PointTransaction lot = creditLot(1L, 100, 50, oldExpiry);
        lot.setNote("Original note");
        LocalDateTime newExpiry = NOW.plusMonths(12);

        when(pointTransactionRepository.findById(1L)).thenReturn(Optional.of(lot));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.extendLotExpiry(1L, newExpiry, "Admin extended");

        assertTrue(lot.getNote().contains("Original note"), "Should preserve existing note");
        assertTrue(lot.getNote().contains("Admin extended"), "Should include reason");
        assertTrue(lot.getNote().contains(oldExpiry.toString()), "Should include old expiry");
        assertTrue(lot.getNote().contains(newExpiry.toString()), "Should include new expiry");
    }

    // ══════════════════════════════════════════════════════════════════
    // expireForCustomerAdmin
    // ══════════════════════════════════════════════════════════════════

    @Test
    void expireForCustomerAdmin_noLoyaltyRecord_throws404() {
        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.expireForCustomerAdmin(CUSTOMER_ID));
        assertEquals(org.springframework.http.HttpStatus.NOT_FOUND, ex.getStatusCode());
    }

    @Test
    void expireForCustomerAdmin_noExpiredLots_returnsZeroResultWithChangedFalse() {
        CustomerLoyalty cl = loyalty(200, 0);
        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(Collections.emptyList());

        var result = service.expireForCustomerAdmin(CUSTOMER_ID);

        assertFalse(result.isChanged());
        assertEquals(0, result.getLotsExpired());
        assertEquals(0, result.getPointsExpired());
        assertEquals(200, result.getAvailablePointsBefore());
        assertEquals(200, result.getAvailablePointsAfter());
        assertEquals(CUSTOMER_ID, result.getCustomerId());
        assertNotNull(result.getCheckedAt());
    }

    @Test
    void expireForCustomerAdmin_expiredLot_returnsRealResultWithChangedTrue() {
        CustomerLoyalty cl = loyalty(100, 0);
        PointTransaction lot = creditLot(5L, 100, 100, NOW.minusDays(1));

        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(List.of(lot));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> {
            PointTransaction tx = inv.getArgument(0);
            if (tx.getId() == null) tx.setId(99L);
            return tx;
        });

        var result = service.expireForCustomerAdmin(CUSTOMER_ID);

        assertTrue(result.isChanged());
        assertEquals(1, result.getLotsExpired());
        assertEquals(100, result.getPointsExpired());
        assertEquals(100, result.getAvailablePointsBefore());
        assertEquals(0, result.getAvailablePointsAfter());
        assertEquals(0, result.getExpiredPointsBefore());
        assertEquals(100, result.getExpiredPointsAfter());
    }

    // ══════════════════════════════════════════════════════════════════
    // Edge cases
    // ══════════════════════════════════════════════════════════════════

    @Test
    void consumePointsFifo_exactlyCoversAllLots_noRemainingPoints() {
        CustomerLoyalty cl = loyalty(100, 0);
        PointTransaction lot1 = creditLot(1L, 60, 60, NOW.plusDays(5));
        PointTransaction lot2 = creditLot(2L, 40, 40, NOW.plusMonths(2));

        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.findExpiredCreditLots(eq(CUSTOMER_ID), any()))
                .thenReturn(Collections.emptyList());
        when(pointTransactionRepository.findActiveCreditLotsForFifo(eq(CUSTOMER_ID), any()))
                .thenReturn(List.of(lot1, lot2));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> {
            PointTransaction tx = inv.getArgument(0);
            if (tx.getId() == null) tx.setId(800L);
            return tx;
        });

        service.consumePointsFifo(CUSTOMER_ID, 100, null);

        assertEquals(0, lot1.getRemainingPoints());
        assertEquals(0, lot2.getRemainingPoints());
        assertEquals(0, cl.getAvailablePoints());
        assertEquals(100, cl.getRedeemedPoints());
    }

    // ── Setup helpers ─────────────────────────────────────────────────────────

    private PointTransaction redeemTx(Long id, int points) {
        PointTransaction t = new PointTransaction();
        t.setId(id);
        t.setCustomerId(CUSTOMER_ID);
        t.setPoints(points);
        t.setType("REDEEM");
        return t;
    }

    private PointTransactionAllocation alloc(Long debitId, Long creditId, int pts) {
        PointTransactionAllocation a = new PointTransactionAllocation();
        a.setDebitTransactionId(debitId);
        a.setCreditTransactionId(creditId);
        a.setAllocatedPoints(pts);
        return a;
    }

    private void setupRefundMocks(Long bookingId,
                                   PointTransaction redeemTx,
                                   List<PointTransactionAllocation> allocs,
                                   List<PointTransaction> creditLots,
                                   CustomerLoyalty cl) {
        when(pointTransactionRepository.findByBookingIdAndType(bookingId, "REDEEM"))
                .thenReturn(Optional.of(redeemTx));
        when(pointTransactionRepository.findByBookingIdAndType(bookingId, "REFUND"))
                .thenReturn(Optional.empty());
        when(allocationRepository.findByDebitTransactionId(redeemTx.getId()))
                .thenReturn(allocs);
        for (PointTransaction lot : creditLots) {
            when(pointTransactionRepository.findById(lot.getId())).thenReturn(Optional.of(lot));
        }
        when(customerLoyaltyRepository.findByCustomerIdWithLock(CUSTOMER_ID))
                .thenReturn(Optional.of(cl));
        when(pointTransactionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }
}
