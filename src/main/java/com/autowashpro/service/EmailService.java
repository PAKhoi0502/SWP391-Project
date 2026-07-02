package com.autowashpro.service;

public interface EmailService {

    // ===================== INTERNAL =====================
    void sendEmail(String to, String subject, String htmlContent);

    void sendBookingConfirmationEmail(Long bookingId);

    void sendPaymentConfirmedEmail(Long bookingId);

    void sendWaitlistOfferedEmail(Long waitlistId);

    void sendBookingReminderEmail(Long bookingId);

    // ===================== AUTH =====================
    void sendWelcomeEmail(String to, String fullName);

    void sendForgotPasswordEmail(String to, String fullName, String token);

    // ===================== ADMIN TEST =====================
    void sendTestEmail(String to);
}