package com.autowashpro.service.impl;

import com.autowashpro.dto.response.NotificationResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.Notification;
import com.autowashpro.entity.PointTransaction;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.NotificationRepository;
import com.autowashpro.repository.PointTransactionRepository;
import com.autowashpro.repository.WaitlistRepository;
import com.autowashpro.support.TestFixtures;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceImplTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private WaitlistRepository waitlistRepository;

    @Mock
    private PointTransactionRepository pointTransactionRepository;

    @InjectMocks
    private NotificationServiceImpl notificationService;

    @Test
    void notifyBookingConfirmedCreatesCustomerNotification() {
        Booking booking = confirmedBooking();
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);

        notificationService.notifyBookingConfirmed(booking.getId());

        verify(notificationRepository).save(notificationCaptor.capture());
        Notification notification = notificationCaptor.getValue();
        assertEquals(booking.getCustomerId(), notification.getUserId());
        assertEquals(booking.getId(), notification.getBookingId());
        assertEquals("APP", notification.getChannel());
        assertEquals("BOOKING_CONFIRMED", notification.getEventType());
        assertEquals(false, notification.getIsRead());
        assertNotNull(notification.getSentAt());
    }

    @Test
    void notifyPaymentConfirmedCreatesCustomerNotification() {
        Booking booking = confirmedBooking();
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);

        notificationService.notifyPaymentConfirmed(booking.getId());

        verify(notificationRepository).save(notificationCaptor.capture());
        Notification notification = notificationCaptor.getValue();
        assertEquals("PAYMENT_CONFIRMED", notification.getEventType());
        assertEquals("Payment Confirmed", notification.getTitle());
        assertTrue(notification.getMessage().contains("#" + booking.getId()));
    }

    @Test
    void notifyDepositRefundCompletedCreatesCustomerNotification() {
        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);

        notificationService.notifyDepositRefundCompleted(7L, 20L, new BigDecimal("45000.00"));

        verify(notificationRepository).save(notificationCaptor.capture());
        Notification notification = notificationCaptor.getValue();
        assertEquals(7L, notification.getUserId());
        assertEquals(20L, notification.getBookingId());
        assertEquals("DEPOSIT_REFUND_COMPLETED", notification.getEventType());
        assertEquals("Deposit Refunded", notification.getTitle());
        assertTrue(notification.getMessage().contains("45000.00"));
        assertEquals(false, notification.getIsRead());
        assertNotNull(notification.getSentAt());
    }

    @Test
    void notifyRewardEarnedCreatesNotificationWhenEarnTransactionExists() {
        Booking booking = confirmedBooking();
        PointTransaction transaction = new PointTransaction();
        transaction.setPoints(25);
        when(notificationRepository.existsByBookingIdAndEventType(booking.getId(), "REWARD_EARNED"))
                .thenReturn(false);
        when(pointTransactionRepository.findByBookingIdAndType(booking.getId(), "EARN"))
                .thenReturn(Optional.of(transaction));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);

        notificationService.notifyRewardEarned(booking.getId());

        verify(notificationRepository).save(notificationCaptor.capture());
        Notification notification = notificationCaptor.getValue();
        assertEquals("REWARD_EARNED", notification.getEventType());
        assertTrue(notification.getMessage().contains("25"));
    }

    @Test
    void notifyRewardEarnedIsIdempotentWhenNotificationExists() {
        when(notificationRepository.existsByBookingIdAndEventType(20L, "REWARD_EARNED"))
                .thenReturn(true);

        notificationService.notifyRewardEarned(20L);

        verify(pointTransactionRepository, never()).findByBookingIdAndType(any(), any());
        verify(notificationRepository, never()).save(any());
    }

    @Test
    void getMyNotificationsFiltersReadState() {
        Notification notification = notification(7L, 20L, "BOOKING_CONFIRMED");
        PageRequest pageable = PageRequest.of(0, 10);
        when(notificationRepository.findByUserIdAndIsReadOrderByCreatedAtDesc(7L, false, pageable))
                .thenReturn(new PageImpl<>(List.of(notification), pageable, 1));

        Page<NotificationResponse> page = notificationService.getMyNotifications(7L, false, 1, 10);

        assertEquals(1, page.getTotalElements());
        assertEquals("BOOKING_CONFIRMED", page.getContent().get(0).getEventType());
    }

    @Test
    void getMyNotificationDetailRejectsOtherOwner() {
        Notification notification = notification(8L, 20L, "BOOKING_CONFIRMED");
        when(notificationRepository.findById(notification.getId())).thenReturn(Optional.of(notification));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> notificationService.getMyNotificationDetail(notification.getId(), 7L));

        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    }

    @Test
    void markAsReadSetsReadFieldsOnce() {
        Notification notification = notification(7L, 20L, "BOOKING_CONFIRMED");
        notification.setIsRead(false);
        when(notificationRepository.findById(notification.getId())).thenReturn(Optional.of(notification));

        NotificationResponse response = notificationService.markAsRead(notification.getId(), 7L);

        assertEquals(true, response.getIsRead());
        assertNotNull(response.getReadAt());
        verify(notificationRepository).save(notification);
    }

    @Test
    void markAsReadRejectsOtherOwner() {
        Notification notification = notification(8L, 20L, "BOOKING_CONFIRMED");
        when(notificationRepository.findById(notification.getId())).thenReturn(Optional.of(notification));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> notificationService.markAsRead(notification.getId(), 7L));

        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
        verify(notificationRepository, never()).save(any());
    }

    @Test
    void markAllAsReadDelegatesToRepositoryForCurrentUser() {
        when(notificationRepository.markAllAsRead(7L)).thenReturn(3);

        int count = notificationService.markAllAsRead(7L);

        assertEquals(3, count);
        verify(notificationRepository).markAllAsRead(7L);
    }

    private Booking confirmedBooking() {
        User customer = TestFixtures.customer();
        Vehicle vehicle = TestFixtures.car(customer);
        ServicePackage servicePackage = TestFixtures.carWashPackage();
        Booking booking = TestFixtures.confirmedBooking(customer, vehicle, TestFixtures.garage(), servicePackage);
        booking.setId(20L);
        return booking;
    }

    private Notification notification(Long userId, Long bookingId, String eventType) {
        Notification notification = new Notification();
        notification.setId(1L);
        notification.setUserId(userId);
        notification.setBookingId(bookingId);
        notification.setChannel("APP");
        notification.setEventType(eventType);
        notification.setTitle("Title");
        notification.setMessage("Message");
        notification.setIsRead(false);
        return notification;
    }
}
