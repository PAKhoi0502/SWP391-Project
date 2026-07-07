package com.autowashpro.service.impl;

import com.autowashpro.entity.Booking;
import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.entity.LoyaltyTierRule;
import com.autowashpro.entity.PointTransaction;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.CustomerLoyaltyRepository;
import com.autowashpro.repository.LoyaltyTierRuleRepository;
import com.autowashpro.repository.PointTransactionRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.service.EmailService;
import com.autowashpro.service.NotificationService;
import com.autowashpro.support.TestFixtures;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LoyaltyServiceImplTest {

    @Mock
    private CustomerLoyaltyRepository customerLoyaltyRepository;

    @Mock
    private LoyaltyTierRuleRepository loyaltyTierRuleRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private PointTransactionRepository pointTransactionRepository;

    @Mock
    private ServicePackageRepository servicePackageRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private LoyaltyServiceImpl loyaltyService;

    @Test
    void updateBookingStatisticsAddsSpentVisitsAndMarksRewardProcessed() {
        User customer = TestFixtures.customer();
        Booking booking = paidCompletedBooking(customer);
        CustomerLoyalty loyalty = TestFixtures.loyalty(customer);
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(customerLoyaltyRepository.findByCustomerId(customer.getId())).thenReturn(Optional.of(loyalty));

        loyaltyService.updateBookingStatistics(booking.getId());

        assertMoney("240000.00", loyalty.getTotalSpent());
        assertEquals(2, loyalty.getTotalVisits());
        assertNotNull(loyalty.getLastVisitAt());
        assertTrue(booking.getRewardProcessed());
        verify(customerLoyaltyRepository).save(loyalty);
        verify(bookingRepository).save(booking);
    }

    @Test
    void updateBookingStatisticsIsIdempotentWhenRewardAlreadyProcessed() {
        User customer = TestFixtures.customer();
        Booking booking = paidCompletedBooking(customer);
        booking.setRewardProcessed(true);
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        loyaltyService.updateBookingStatistics(booking.getId());

        verify(customerLoyaltyRepository, never()).save(any());
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void earnPointsAfterPaidBookingCreatesEarnTransaction() {
        User customer = TestFixtures.customer();
        Booking booking = paidCompletedBooking(customer);
        CustomerLoyalty loyalty = TestFixtures.loyalty(customer);
        LoyaltyTierRule bronze = TestFixtures.bronzeTierRule();
        bronze.setPointMultiplier(new BigDecimal("1.50"));
        ServicePackage servicePackage = TestFixtures.carWashPackage();
        servicePackage.setPointsEarned(20);
        when(pointTransactionRepository.findByBookingIdAndType(booking.getId(), "EARN")).thenReturn(Optional.empty());
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(customerLoyaltyRepository.findByCustomerId(customer.getId())).thenReturn(Optional.of(loyalty));
        when(loyaltyTierRuleRepository.findByTierAndIsActiveTrue("BRONZE")).thenReturn(Optional.of(bronze));
        when(servicePackageRepository.findById(servicePackage.getId())).thenReturn(Optional.of(servicePackage));
        when(loyaltyTierRuleRepository.findByIsActiveTrueOrderByPriorityLevelDesc()).thenReturn(List.of(bronze));
        ArgumentCaptor<PointTransaction> transactionCaptor = ArgumentCaptor.forClass(PointTransaction.class);

        loyaltyService.earnPointsAfterPaidBooking(booking.getId());

        assertEquals(130, loyalty.getTotalPoints());
        assertEquals(130, loyalty.getAvailablePoints());
        verify(pointTransactionRepository).save(transactionCaptor.capture());
        PointTransaction transaction = transactionCaptor.getValue();
        assertEquals(customer.getId(), transaction.getCustomerId());
        assertEquals(booking.getId(), transaction.getBookingId());
        assertEquals("EARN", transaction.getType());
        assertEquals(30, transaction.getPoints());
        assertEquals(30, transaction.getRemainingPoints());
        assertEquals("BOOKING_EARN", transaction.getSource());
        assertNotNull(transaction.getExpiredAt());
    }

    @Test
    void earnPointsAfterPaidBookingIsIdempotentWhenEarnTransactionExists() {
        PointTransaction existing = new PointTransaction();
        existing.setId(1L);
        when(pointTransactionRepository.findByBookingIdAndType(20L, "EARN")).thenReturn(Optional.of(existing));

        loyaltyService.earnPointsAfterPaidBooking(20L);

        verify(bookingRepository, never()).findById(any());
        verify(customerLoyaltyRepository, never()).save(any());
        verify(pointTransactionRepository, never()).save(any());
    }

    @Test
    void earnPointsAfterPaidBookingSkipsUnpaidBooking() {
        User customer = TestFixtures.customer();
        Booking booking = paidCompletedBooking(customer);
        booking.setPaymentStatus("UNPAID");
        when(pointTransactionRepository.findByBookingIdAndType(booking.getId(), "EARN")).thenReturn(Optional.empty());
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        loyaltyService.earnPointsAfterPaidBooking(booking.getId());

        verify(customerLoyaltyRepository, never()).save(any());
        verify(pointTransactionRepository, never()).save(any());
    }

    @Test
    void earnPointsAfterPaidBookingSkipsNonCompletedBooking() {
        User customer = TestFixtures.customer();
        Booking booking = paidCompletedBooking(customer);
        booking.setStatus("IN_PROGRESS");
        when(pointTransactionRepository.findByBookingIdAndType(booking.getId(), "EARN")).thenReturn(Optional.empty());
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        loyaltyService.earnPointsAfterPaidBooking(booking.getId());

        verify(customerLoyaltyRepository, never()).save(any());
        verify(pointTransactionRepository, never()).save(any());
    }

    @Test
    void earnPointsAfterPaidBookingSkipsGuestBooking() {
        Booking booking = paidCompletedBooking(TestFixtures.customer());
        booking.setCustomerId(null);
        when(pointTransactionRepository.findByBookingIdAndType(booking.getId(), "EARN")).thenReturn(Optional.empty());
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        loyaltyService.earnPointsAfterPaidBooking(booking.getId());

        verify(customerLoyaltyRepository, never()).save(any());
        verify(pointTransactionRepository, never()).save(any());
    }

    @Test
    void earnPointsAfterPaidBookingSkipsWhenCalculatedPointsAreZero() {
        User customer = TestFixtures.customer();
        Booking booking = paidCompletedBooking(customer);
        booking.setOriginalPrice(new BigDecimal("5000.00"));
        booking.setFinalPrice(new BigDecimal("5000.00"));
        CustomerLoyalty loyalty = TestFixtures.loyalty(customer);
        LoyaltyTierRule bronze = TestFixtures.bronzeTierRule();
        ServicePackage servicePackage = TestFixtures.carWashPackage();
        servicePackage.setPointsEarned(0);
        when(pointTransactionRepository.findByBookingIdAndType(booking.getId(), "EARN")).thenReturn(Optional.empty());
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(customerLoyaltyRepository.findByCustomerId(customer.getId())).thenReturn(Optional.of(loyalty));
        when(loyaltyTierRuleRepository.findByTierAndIsActiveTrue("BRONZE")).thenReturn(Optional.of(bronze));
        when(servicePackageRepository.findById(servicePackage.getId())).thenReturn(Optional.of(servicePackage));

        loyaltyService.earnPointsAfterPaidBooking(booking.getId());

        assertEquals(100, loyalty.getTotalPoints());
        assertEquals(100, loyalty.getAvailablePoints());
        verify(customerLoyaltyRepository, never()).save(any());
        verify(pointTransactionRepository, never()).save(any());
    }

    private Booking paidCompletedBooking(User customer) {
        Vehicle vehicle = TestFixtures.car(customer);
        ServicePackage servicePackage = TestFixtures.carWashPackage();
        Booking booking = TestFixtures.confirmedBooking(customer, vehicle, TestFixtures.garage(), servicePackage);
        booking.setId(20L);
        booking.setStatus("COMPLETED");
        booking.setPaymentStatus("PAID");
        booking.setCompletedAt(TestFixtures.BASE_TIME.plusHours(1));
        booking.setPaidAt(TestFixtures.BASE_TIME.plusHours(2));
        booking.setRewardProcessed(false);
        return booking;
    }

    private void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual));
    }
}
