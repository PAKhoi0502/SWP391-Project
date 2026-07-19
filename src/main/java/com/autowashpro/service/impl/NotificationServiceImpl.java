package com.autowashpro.service.impl;

import com.autowashpro.dto.response.NotificationResponse;
import com.autowashpro.entity.Notification;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.NotificationRepository;
import com.autowashpro.repository.PointTransactionRepository;
import com.autowashpro.repository.WaitlistRepository;
import com.autowashpro.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final BookingRepository bookingRepository;
    private final WaitlistRepository waitlistRepository;
    private final PointTransactionRepository pointTransactionRepository;

    // ===================== INTERNAL =====================

    @Override
    @Transactional
    public void createInAppNotification(Long userId, Long bookingId, String eventType, String title, String message) {
        if (userId == null) {
            log.debug("[NOTIFICATION_SKIP] userId is null, skipping notification for event {}", eventType);
            return;
        }

        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setBookingId(bookingId);
        notification.setChannel("APP");
        notification.setEventType(eventType);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setIsRead(false);
        notification.setSentAt(LocalDateTime.now());

        notificationRepository.save(notification);
        log.info("[NOTIFICATION_CREATED] userId={}, eventType={}, bookingId={}", userId, eventType, bookingId);
    }

    @Override
    @Transactional
    public void notifyBookingConfirmed(Long bookingId) {
        bookingRepository.findById(bookingId).ifPresent(booking -> {
            if (booking.getCustomerId() == null) return;

            createInAppNotification(
                    booking.getCustomerId(),
                    bookingId,
                    "BOOKING_CONFIRMED",
                    "Booking Confirmed",
                    "Your booking #" + bookingId + " has been confirmed successfully."
            );
        });
    }

    @Override
    @Transactional
    public void notifyBookingCanceled(Long bookingId) {
        bookingRepository.findById(bookingId).ifPresent(booking -> {
            if (booking.getCustomerId() == null) return;

            String reason = booking.getNote() != null ? " Reason: " + booking.getNote() : "";
            createInAppNotification(
                    booking.getCustomerId(),
                    bookingId,
                    "BOOKING_CANCELED",
                    "Booking Canceled",
                    "Your booking #" + bookingId + " has been canceled." + reason
            );
        });
    }

    @Override
    @Transactional
    public void notifyPaymentConfirmed(Long bookingId) {
        bookingRepository.findById(bookingId).ifPresent(booking -> {
            if (booking.getCustomerId() == null) return;

            createInAppNotification(
                    booking.getCustomerId(),
                    bookingId,
                    "PAYMENT_CONFIRMED",
                    "Payment Confirmed",
                    "Payment for booking #" + bookingId + " has been confirmed. Thank you!"
            );
        });
    }

    @Override
    @Transactional
    public void notifyRewardEarned(Long bookingId) {
        // Guard against duplicate: BookingService and PaymentService both call this
        if (notificationRepository.existsByBookingIdAndEventType(bookingId, "REWARD_EARNED")) {
            return;
        }
        // Lấy earned points từ EARN transaction
        pointTransactionRepository.findByBookingIdAndType(bookingId, "EARN").ifPresent(pt -> {
            bookingRepository.findById(bookingId).ifPresent(booking -> {
                if (booking.getCustomerId() == null) return;

                createInAppNotification(
                        booking.getCustomerId(),
                        bookingId,
                        "REWARD_EARNED",
                        "Points Earned",
                        "You earned " + pt.getPoints() + " loyalty points from booking #" + bookingId + "!"
                );
            });
        });
    }

    @Override
    @Transactional
    public void notifyWaitlistOffered(Long waitlistId) {
        waitlistRepository.findById(waitlistId).ifPresent(waitlist -> {
            if (waitlist.getCustomerId() == null) return;

            createInAppNotification(
                    waitlist.getCustomerId(),
                    null,
                    "WAITLIST_OFFER",
                    "Waitlist Offer Available",
                    "A slot is now available for your waitlist request at garage #"
                            + waitlist.getGarageId()
                            + " on " + waitlist.getDesiredStartTime().toLocalDate()
                            + ". Accept it before " + waitlist.getOfferExpiresAt() + "!"
            );
        });
    }

    @Override
    @Transactional
    public void notifyPaymentAndReward(Long bookingId) {
        if (notificationRepository.existsByBookingIdAndEventType(bookingId, "PAYMENT_CONFIRMED")) return;
        bookingRepository.findById(bookingId).ifPresent(booking -> {
            if (booking.getCustomerId() == null) return;
            String pointsPart = pointTransactionRepository.findByBookingIdAndType(bookingId, "EARN")
                    .map(pt -> " You earned +" + pt.getPoints() + " loyalty points.")
                    .orElse("");
            createInAppNotification(
                    booking.getCustomerId(),
                    bookingId,
                    "PAYMENT_CONFIRMED",
                    "Payment confirmed" + (pointsPart.isEmpty() ? "" : " & points earned"),
                    "Payment for booking #" + bookingId + " has been confirmed." + pointsPart + " Thank you!"
            );
        });
    }

    @Override
@Transactional
public void notifyTierUpgraded(Long customerId, String oldTier, String newTier) {
    createInAppNotification(
            customerId,
            null,
            "TIER_UPGRADED",
            "Tier Upgraded! 🎉",
            "Congratulations! You have been upgraded from " + oldTier + " to " + newTier + " tier!"
    );
}

@Override
@Transactional
public void notifyVoucherReceived(Long customerId, String promotionCode, String promotionName) {
    createInAppNotification(
            customerId,
            null,
            "VOUCHER_RECEIVED",
            "Voucher Received! 🎁",
            "You received a voucher: " + promotionName + " (Code: " + promotionCode + "). Use it on your next booking!"
    );
}
    @Override
    @Transactional
    public void notifyPointsAdjusted(Long customerId, Integer points, String reason) {
        String sign = points > 0 ? "+" : "";
        String title = points > 0 ? "Points Added" : "Points Deducted";
        String body = sign + points + " loyalty points have been adjusted to your account"
                + (reason != null && !reason.isBlank() ? ": " + reason : "") + ".";
        createInAppNotification(customerId, null, "POINTS_ADJUSTED", title, body);
    }

    @Override
    @Transactional
    public void notifyDepositRefundApproved(Long customerId, Long bookingId, java.math.BigDecimal amount) {
        createInAppNotification(
                customerId,
                bookingId,
                "DEPOSIT_REFUND_APPROVED",
                "Refund Request Approved",
                "Your deposit refund request of " + amount + " for booking #" + bookingId
                        + " has been approved and will be processed soon."
        );
    }

    @Override
    @Transactional
    public void notifyDepositRefundRejected(Long customerId, Long bookingId, String reason) {
        createInAppNotification(
                customerId,
                bookingId,
                "DEPOSIT_REFUND_REJECTED",
                "Refund Request Rejected",
                "Your deposit refund request for booking #" + bookingId + " was rejected." +
                        (reason != null && !reason.isBlank() ? " Reason: " + reason : "")
        );
    }

    @Override
    @Transactional
    public void notifyDepositRefundCompleted(Long customerId, Long bookingId, java.math.BigDecimal amount) {
        createInAppNotification(
                customerId,
                bookingId,
                "DEPOSIT_REFUND_COMPLETED",
                "Deposit Refunded",
                "Your deposit refund of " + amount + " for booking #" + bookingId
                        + " has been transferred to your bank account."
        );
    }

    // ===================== API =====================

    @Override
    public Page<NotificationResponse> getMyNotifications(Long userId, Boolean isRead, int page, int limit) {
        PageRequest pageable = PageRequest.of(page - 1, limit);

        if (isRead != null) {
            return notificationRepository
                    .findByUserIdAndIsReadOrderByCreatedAtDesc(userId, isRead, pageable)
                    .map(this::toResponse);
        }

        return notificationRepository
                .findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::toResponse);
    }

    @Override
    public NotificationResponse getMyNotificationDetail(Long id, Long userId) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Notification not found: " + id));

        if (!notification.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You cannot access this notification");
        }

        return toResponse(notification);
    }

    @Override
    @Transactional
    public NotificationResponse markAsRead(Long id, Long userId) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Notification not found: " + id));

        if (!notification.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You cannot update this notification");
        }

        if (!Boolean.TRUE.equals(notification.getIsRead())) {
            notification.setIsRead(true);
            notification.setReadAt(LocalDateTime.now());
            notificationRepository.save(notification);
        }

        return toResponse(notification);
    }

    @Override
    @Transactional
    public int markAllAsRead(Long userId) {
        return notificationRepository.markAllAsRead(userId);
    }

    @Override
    @Transactional
    public void deleteNotification(Long id, Long userId) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Notification not found: " + id));

        if (!notification.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You cannot delete this notification");
        }

        notificationRepository.delete(notification);
    }

    // ===================== HELPER =====================

    private NotificationResponse toResponse(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .userId(n.getUserId())
                .bookingId(n.getBookingId())
                .channel(n.getChannel())
                .eventType(n.getEventType())
                .title(n.getTitle())
                .message(n.getMessage())
                .isRead(n.getIsRead())
                .readAt(n.getReadAt())
                .sentAt(n.getSentAt())
                .createdAt(n.getCreatedAt())
                .build();
    }
}