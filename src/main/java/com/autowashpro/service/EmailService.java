package com.autowashpro.service;

import java.time.LocalDateTime;

public interface EmailService {

    // ===================== INTERNAL =====================
    void sendEmail(String to, String subject, String htmlContent);

    void sendBookingConfirmationEmail(Long bookingId);

    void sendPaymentConfirmedEmail(Long bookingId);

    void sendWaitlistOfferedEmail(Long waitlistId, LocalDateTime offerExpiresAt);

    void sendBookingReminderEmail(Long bookingId);

    void sendTierUpgradedEmail(String to, String fullName, String oldTier, String newTier);
    
    // ===================== AUTH =====================
    void sendWelcomeEmail(String to, String fullName);

    void sendForgotPasswordEmail(String to, String fullName, String token);

    // ===================== ADMIN TEST =====================
    void sendTestEmail(String to);
}