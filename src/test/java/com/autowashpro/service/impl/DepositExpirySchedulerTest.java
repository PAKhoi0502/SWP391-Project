package com.autowashpro.service.impl;

import com.autowashpro.entity.Booking;
import com.autowashpro.entity.PaymentTransaction;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.repository.BookingAddOnServicePackageRepository;
import com.autowashpro.repository.BookingAssignedStaffRepository;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.BookingServiceStepRepository;
import com.autowashpro.repository.CustomerLoyaltyRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.LoyaltyTierRuleRepository;
import com.autowashpro.repository.PaymentTransactionRepository;
import com.autowashpro.repository.PointTransactionRepository;
import com.autowashpro.repository.PromotionRepository;
import com.autowashpro.repository.PromotionUsageRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.ServicePackageStepRepository;
import com.autowashpro.repository.StaffProfileRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.repository.VehicleInspectionRepository;
import com.autowashpro.repository.VehicleRepository;
import com.autowashpro.repository.WashBayRepository;
import com.autowashpro.scheduler.DepositTimeoutScheduler;
import com.autowashpro.service.BookingReviewService;
import com.autowashpro.service.EmailService;
import com.autowashpro.service.LoyaltyPointExpiryService;
import com.autowashpro.service.LoyaltyService;
import com.autowashpro.service.NotificationService;
import com.autowashpro.service.PromotionService;
import com.autowashpro.service.WashHistoryService;
import com.autowashpro.service.support.PackageResourceResolver;
import com.autowashpro.service.support.StaffOperationAccessPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Mandatory tests for the deposit-expiry scheduler (PHẦN 1).
 *
 * 1. Expired PENDING_DEPOSIT booking → CANCELED
 * 2. Not yet expired → not touched
 * 3. depositStatus=PAID → not canceled
 * 4. depositStatus=REFUND_PENDING → not canceled
 * 5. depositStatus=REFUNDED → not canceled
 * 6. Running expiry twice is idempotent (no duplicate notification)
 * 7. Property deposit.scheduler.enabled=false → scheduler skips
 * 8. Property deposit.scheduler.enabled=true → scheduler runs
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DepositExpirySchedulerTest {

    // ── Full set of BookingServiceImpl mocks ─────────────────────────────────

    @Mock GarageRepository garageRepository;
    @Mock ServicePackageRepository servicePackageRepository;
    @Mock WashBayRepository washBayRepository;
    @Mock BookingRepository bookingRepository;
    @Mock VehicleRepository vehicleRepository;
    @Mock CustomerLoyaltyRepository customerLoyaltyRepository;
    @Mock LoyaltyTierRuleRepository loyaltyTierRuleRepository;
    @Mock PromotionRepository promotionRepository;
    @Mock PromotionUsageRepository promotionUsageRepository;
    @Mock BookingAssignedStaffRepository bookingAssignedStaffRepository;
    @Mock StaffProfileRepository staffProfileRepository;
    @Mock UserRepository userRepository;
    @Mock BookingServiceStepRepository bookingServiceStepRepository;
    @Mock ServicePackageStepRepository servicePackageStepRepository;
    @Mock VehicleInspectionRepository vehicleInspectionRepository;
    @Mock BookingAddOnServicePackageRepository bookingAddOnServicePackageRepository;
    @Mock PointTransactionRepository pointTransactionRepository;
    @Mock PaymentTransactionRepository paymentTransactionRepository;
    @Mock LoyaltyService loyaltyService;
    @Mock LoyaltyPointExpiryService loyaltyPointExpiryService;
    @Mock WashHistoryService washHistoryService;
    @Mock PromotionService promotionService;
    @Mock NotificationService notificationService;
    @Mock EmailService emailService;
    @Mock BookingReviewService bookingReviewService;
    @Mock ComboStepResolver comboStepResolver;
    @Mock PackageResourceResolver packageResourceResolver;
    @Mock StaffOperationAccessPolicy staffOperationAccessPolicy;

    @InjectMocks BookingServiceImpl bookingService;

    DepositTimeoutScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new DepositTimeoutScheduler(bookingService);
        ReflectionTestUtils.setField(scheduler, "schedulerEnabled", true);

        // Default: no pending transactions to expire
        lenient().when(paymentTransactionRepository
                .findByBookingIdAndPurposeOrderByCreatedAtDesc(anyLong(), any()))
                .thenReturn(Collections.emptyList());

        // Default: no wash bay assigned on PENDING_DEPOSIT booking
        lenient().when(washBayRepository.findById(any())).thenReturn(java.util.Optional.empty());
        lenient().when(bookingAssignedStaffRepository.findByBookingId(anyLong()))
                .thenReturn(Collections.emptyList());
    }

    // ── 1. Expired PENDING_DEPOSIT booking → CANCELED ────────────────────────

    @Test
    void expiredPendingDeposit_isCanceled() {
        Booking expired = pendingDepositBooking(1L, LocalDateTime.now().minusMinutes(5));
        when(bookingRepository.findExpiredPendingDeposits(any()))
                .thenReturn(List.of(expired));
        when(bookingRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        bookingService.expirePendingDeposits();

        assertEquals("CANCELED", expired.getStatus());
        assertEquals("EXPIRED", expired.getPaymentStatus());
        assertEquals("Deposit payment expired", expired.getNote());
        verify(notificationService).notifyBookingCanceled(1L);
        verify(bookingRepository).save(expired);
    }

    // ── 2. Not yet expired → not touched ─────────────────────────────────────

    @Test
    void notYetExpired_booking_isNotTouched() {
        // The query itself filters by paymentExpiredAt <= now, so no results returned
        when(bookingRepository.findExpiredPendingDeposits(any()))
                .thenReturn(Collections.emptyList());

        bookingService.expirePendingDeposits();

        verify(bookingRepository, never()).save(any());
        verify(notificationService, never()).notifyBookingCanceled(any());
    }

    // ── 3. depositStatus=PAID → not canceled ─────────────────────────────────

    @Test
    void depositAlreadyPaid_notCanceled() {
        Booking paid = pendingDepositBooking(2L, LocalDateTime.now().minusMinutes(5));
        paid.setDepositStatus("PAID");
        when(bookingRepository.findExpiredPendingDeposits(any()))
                .thenReturn(List.of(paid));

        bookingService.expirePendingDeposits();

        // Idempotency guard fires — booking not saved
        verify(bookingRepository, never()).save(any());
        verify(notificationService, never()).notifyBookingCanceled(any());
        assertEquals("PENDING_DEPOSIT", paid.getStatus());
    }

    // ── 4. depositStatus=REFUND_PENDING → not canceled ───────────────────────

    @Test
    void depositRefundPending_notCanceled() {
        Booking refundPending = pendingDepositBooking(3L, LocalDateTime.now().minusMinutes(5));
        refundPending.setDepositStatus("REFUND_PENDING");
        when(bookingRepository.findExpiredPendingDeposits(any()))
                .thenReturn(List.of(refundPending));

        bookingService.expirePendingDeposits();

        verify(bookingRepository, never()).save(any());
        verify(notificationService, never()).notifyBookingCanceled(any());
    }

    // ── 5. depositStatus=REFUNDED → not canceled ─────────────────────────────

    @Test
    void depositRefunded_notCanceled() {
        Booking refunded = pendingDepositBooking(4L, LocalDateTime.now().minusMinutes(5));
        refunded.setDepositStatus("REFUNDED");
        when(bookingRepository.findExpiredPendingDeposits(any()))
                .thenReturn(List.of(refunded));

        bookingService.expirePendingDeposits();

        verify(bookingRepository, never()).save(any());
        verify(notificationService, never()).notifyBookingCanceled(any());
    }

    // ── 6. Running expiry twice is idempotent ─────────────────────────────────

    @Test
    void runningExpireTwice_idempotent() {
        Booking booking = pendingDepositBooking(5L, LocalDateTime.now().minusMinutes(5));
        when(bookingRepository.findExpiredPendingDeposits(any()))
                .thenReturn(List.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> {
            Booking b = inv.getArgument(0);
            b.setStatus("CANCELED");
            return b;
        });

        // First run: expires and saves
        bookingService.expirePendingDeposits();

        // After first run the booking is CANCELED — second run guard fires
        when(bookingRepository.findExpiredPendingDeposits(any()))
                .thenReturn(List.of(booking)); // same object, now CANCELED

        bookingService.expirePendingDeposits();

        // notifyBookingCanceled called exactly once (second run hits idempotency guard)
        verify(notificationService, times(1)).notifyBookingCanceled(5L);
    }

    // ── 7. deposit.scheduler.enabled=false → scheduler skips ────────────────

    @Test
    void schedulerDisabled_doesNotRunExpiry() {
        ReflectionTestUtils.setField(scheduler, "schedulerEnabled", false);

        scheduler.expirePendingDeposits();

        verify(bookingRepository, never()).findExpiredPendingDeposits(any());
    }

    // ── 8. deposit.scheduler.enabled=true → scheduler runs ──────────────────

    @Test
    void schedulerEnabled_runsExpiry() {
        ReflectionTestUtils.setField(scheduler, "schedulerEnabled", true);
        when(bookingRepository.findExpiredPendingDeposits(any()))
                .thenReturn(Collections.emptyList());

        scheduler.expirePendingDeposits();

        verify(bookingRepository).findExpiredPendingDeposits(any());
    }

    // ── 9. Pending PaymentTransaction → marked EXPIRED ────────────────────────

    @Test
    void pendingTransaction_markedExpired() {
        Booking booking = pendingDepositBooking(6L, LocalDateTime.now().minusMinutes(5));
        PaymentTransaction tx = new PaymentTransaction();
        tx.setId(100L);
        tx.setStatus("PENDING");
        tx.setPurpose("DEPOSIT");
        when(bookingRepository.findExpiredPendingDeposits(any()))
                .thenReturn(List.of(booking));
        when(bookingRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(paymentTransactionRepository
                .findByBookingIdAndPurposeOrderByCreatedAtDesc(6L, "DEPOSIT"))
                .thenReturn(List.of(tx));
        when(paymentTransactionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        bookingService.expirePendingDeposits();

        assertEquals("EXPIRED", tx.getStatus());
        assertEquals("Payment timeout", tx.getCancelReason());
        verify(paymentTransactionRepository).save(tx);
    }

    // ── 10. One bad booking doesn't block others ──────────────────────────────

    @Test
    void oneFailedBooking_doesNotBlockOthers() {
        Booking bad  = pendingDepositBooking(7L, LocalDateTime.now().minusMinutes(5));
        Booking good = pendingDepositBooking(8L, LocalDateTime.now().minusMinutes(5));

        when(bookingRepository.findExpiredPendingDeposits(any()))
                .thenReturn(List.of(bad, good));

        // Save the bad booking throws
        when(bookingRepository.save(bad)).thenThrow(new RuntimeException("DB error"));
        when(bookingRepository.save(good)).thenAnswer(i -> i.getArgument(0));

        // No exception propagates
        bookingService.expirePendingDeposits();

        // Good booking still gets the notification
        verify(notificationService).notifyBookingCanceled(8L);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Booking pendingDepositBooking(Long id, LocalDateTime expiredAt) {
        Booking b = new Booking();
        b.setId(id);
        b.setStatus("PENDING_DEPOSIT");
        b.setDepositStatus("UNPAID");
        b.setPaymentStatus("UNPAID");
        b.setPaymentExpiredAt(expiredAt);
        b.setDepositAmount(BigDecimal.valueOf(150_000));
        b.setFinalPrice(BigDecimal.valueOf(500_000));
        b.setRefundAmount(BigDecimal.ZERO);
        b.setCustomerId(99L);
        b.setGarageId(1L);
        b.setUsedPoints(0);
        return b;
    }
}
