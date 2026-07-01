package com.autowashpro.service;

import com.autowashpro.dto.response.NotificationResponse;
import org.springframework.data.domain.Page;

public interface NotificationService {

    // ===================== INTERNAL =====================
    void createInAppNotification(Long userId, Long bookingId, String eventType, String title, String message);

    void notifyBookingConfirmed(Long bookingId);

    void notifyPaymentConfirmed(Long bookingId);

    void notifyRewardEarned(Long bookingId);

    void notifyWaitlistOffered(Long waitlistId);

    // ===================== API =====================
    Page<NotificationResponse> getMyNotifications(Long userId, Boolean isRead, int page, int limit);

    NotificationResponse getMyNotificationDetail(Long id, Long userId);

    NotificationResponse markAsRead(Long id, Long userId);

    int markAllAsRead(Long userId);

    void deleteNotification(Long id, Long userId);
}