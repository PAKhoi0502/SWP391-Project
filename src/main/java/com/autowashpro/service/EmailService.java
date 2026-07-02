package com.autowashpro.service;

public interface EmailService {

    // ===================== INTERNAL =====================
    void sendEmail(String to, String subject, String htmlContent);

    void sendBookingConfirmationEmail(Long bookingId);

    void sendPaymentConfirmedEmail(Long bookingId);

    void sendWaitlistOfferedEmail(Long waitlistId);

    void sendBookingReminderEmail(Long bookingId);

    // ===================== ADMIN TEST =====================
    void sendTestEmail(String to);
}