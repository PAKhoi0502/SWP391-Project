package com.autowashpro.service.impl;

import com.autowashpro.entity.Booking;
import com.autowashpro.entity.Waitlist;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.repository.WaitlistRepository;
import com.autowashpro.service.EmailService;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final WaitlistRepository waitlistRepository;

    @Value("${app.mail.from}")
    private String fromEmail;

    @Value("${app.mail.from-name}")
    private String fromName;

    @Value("${app.mail.enabled:true}")
    private boolean mailEnabled;

    // ===================== CORE SEND =====================

    @Override
    @Async
    public void sendEmail(String to, String subject, String htmlContent) {
        if (!mailEnabled) {
            return;
        }

        if (to == null || to.isBlank()) {
            log.warn("[EMAIL_SKIP] Recipient email is null or blank, skipping");
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail, fromName);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("[EMAIL_SENT] to={}, subject={}", to, subject);

        } catch (Exception e) {
            log.error("[EMAIL_ERROR] Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    // ===================== BOOKING CONFIRMATION =====================

    @Override
    @Async
    public void sendBookingConfirmationEmail(Long bookingId) {
        bookingRepository.findById(bookingId).ifPresent(booking -> {
            String email = getCustomerEmail(booking);
            if (email == null) {
                log.debug("[EMAIL_SKIP] No email for booking #{}", bookingId);
                return;
            }
            String subject = "[AutoWash Pro] Booking Confirmed - #" + bookingId;
            String html = buildBookingConfirmationHtml(booking);
            sendEmail(email, subject, html);
        });
    }

    private String buildBookingConfirmationHtml(Booking booking) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">🚗 Booking Confirmed!</h2>
                    <p>Dear Customer,</p>
                    <p>Your booking has been confirmed successfully.</p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                        <p><strong>Booking ID:</strong> #%d</p>
                        <p><strong>Service:</strong> Package #%d</p>
                        <p><strong>Date:</strong> %s</p>
                        <p><strong>Time:</strong> %s</p>
                        <p><strong>Total Amount:</strong> %,.0f VND</p>
                    </div>
                    <p>Please arrive on time. Thank you for choosing AutoWash Pro!</p>
                    <hr/>
                    <p style="color: #6b7280; font-size: 12px;">AutoWash Pro - Smart Car Wash Management System</p>
                </div>
                """.formatted(
                booking.getId(),
                booking.getServicePackageId(),
                booking.getBookingDate(),
                booking.getStartTime().toLocalTime(),
                booking.getFinalPrice().doubleValue());
    }

    // ===================== PAYMENT CONFIRMED =====================

    @Override
    @Async
    public void sendPaymentConfirmedEmail(Long bookingId) {
        bookingRepository.findById(bookingId).ifPresent(booking -> {
            String email = getCustomerEmail(booking);
            if (email == null) {
                log.debug("[EMAIL_SKIP] No email for booking #{}", bookingId);
                return;
            }
            String subject = "[AutoWash Pro] Payment Confirmed - #" + bookingId;
            String html = buildPaymentConfirmedHtml(booking);
            sendEmail(email, subject, html);
        });
    }

    private String buildPaymentConfirmedHtml(Booking booking) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #16a34a;">✅ Payment Confirmed!</h2>
                    <p>Dear Customer,</p>
                    <p>Your payment has been received successfully.</p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                        <p><strong>Booking ID:</strong> #%d</p>
                        <p><strong>Amount Paid:</strong> %,.0f VND</p>
                        <p><strong>Payment Method:</strong> %s</p>
                        <p><strong>Paid At:</strong> %s</p>
                    </div>
                    <p>Thank you for using AutoWash Pro!</p>
                    <hr/>
                    <p style="color: #6b7280; font-size: 12px;">AutoWash Pro - Smart Car Wash Management System</p>
                </div>
                """.formatted(
                booking.getId(),
                booking.getFinalPrice().doubleValue(),
                booking.getPaymentMethod() != null ? booking.getPaymentMethod() : "N/A",
                booking.getPaidAt() != null ? booking.getPaidAt().toString() : "N/A");
    }

    // ===================== WAITLIST OFFERED =====================

    @Override
    @Async
    public void sendWaitlistOfferedEmail(Long waitlistId, LocalDateTime offerExpiresAt) {
        waitlistRepository.findById(waitlistId).ifPresent(waitlist -> {
            if (waitlist.getCustomerId() == null) {
                log.debug("[EMAIL_SKIP] Guest waitlist #{}, no email", waitlistId);
                return;
            }
            String email = getUserEmail(waitlist.getCustomerId());
            if (email == null) {
                log.debug("[EMAIL_SKIP] No email for customer #{}", waitlist.getCustomerId());
                return;
            }
            String subject = "[AutoWash Pro] Waitlist Slot Available!";
            String html = buildWaitlistOfferedHtml(waitlist, offerExpiresAt);
            sendEmail(email, subject, html);
        });
    }

    private String buildWaitlistOfferedHtml(Waitlist waitlist, LocalDateTime offerExpiresAt) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #d97706;">🎉 Your Waitlist Slot is Available!</h2>
                    <p>Dear Customer,</p>
                    <p>Great news! A slot has become available for your waitlist request.</p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                        <p><strong>Garage ID:</strong> #%d</p>
                        <p><strong>Desired Date:</strong> %s</p>
                        <p><strong>Desired Time:</strong> %s</p>
                        <p><strong>Offer Expires At:</strong> %s</p>
                    </div>
                    <p>Please log in to the app and accept the offer before it expires!</p>
                    <hr/>
                    <p style="color: #6b7280; font-size: 12px;">AutoWash Pro - Smart Car Wash Management System</p>
                </div>
                """.formatted(
                waitlist.getGarageId(),
                waitlist.getDesiredStartTime().toLocalDate(),
                waitlist.getDesiredStartTime().toLocalTime(),
                offerExpiresAt != null ? offerExpiresAt.toString() : "N/A");
    }

    // ===================== BOOKING REMINDER =====================

    @Override
    @Async
    public void sendBookingReminderEmail(Long bookingId) {
        bookingRepository.findById(bookingId).ifPresent(booking -> {
            String email = getCustomerEmail(booking);
            if (email == null) {
                log.debug("[EMAIL_SKIP] No email for booking #{}", bookingId);
                return;
            }
            String subject = "[AutoWash Pro] Reminder - Your appointment is tomorrow!";
            String html = buildBookingReminderHtml(booking);
            sendEmail(email, subject, html);
        });
    }

    private String buildBookingReminderHtml(Booking booking) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #7c3aed;">⏰ Appointment Reminder</h2>
                    <p>Dear Customer,</p>
                    <p>This is a reminder for your upcoming appointment.</p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                        <p><strong>Booking ID:</strong> #%d</p>
                        <p><strong>Date:</strong> %s</p>
                        <p><strong>Time:</strong> %s</p>
                    </div>
                    <p>Please arrive on time. See you soon!</p>
                    <hr/>
                    <p style="color: #6b7280; font-size: 12px;">AutoWash Pro - Smart Car Wash Management System</p>
                </div>
                """.formatted(
                booking.getId(),
                booking.getBookingDate(),
                booking.getStartTime().toLocalTime());
    }

    // ===================== AUTH =====================

    @Override
    @Async
    public void sendWelcomeEmail(String to, String fullName) {
        String subject = "[AutoWash Pro] Welcome to AutoWash Pro!";
        String html = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">🎉 Welcome to AutoWash Pro!</h2>
                    <p>Dear %s,</p>
                    <p>Your account has been created successfully.</p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                        <p>You can now book car wash appointments, track your loyalty points, and enjoy exclusive member benefits.</p>
                    </div>
                    <p>Thank you for joining AutoWash Pro!</p>
                    <hr/>
                    <p style="color: #6b7280; font-size: 12px;">AutoWash Pro - Smart Car Wash Management System</p>
                </div>
                """.formatted(fullName);
        sendEmail(to, subject, html);
    }

    @Override
    @Async
    public void sendForgotPasswordEmail(String to, String fullName, String token) {
        String subject = "[AutoWash Pro] Reset Your Password";
        String html = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc2626;">🔐 Reset Your Password</h2>
                    <p>Dear %s,</p>
                    <p>We received a request to reset your password.</p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                        <p><strong>Your reset token:</strong></p>
                        <p style="font-size: 18px; font-weight: bold; color: #2563eb; word-break: break-all;">%s</p>
                        <p style="color: #6b7280; font-size: 12px;">This token expires in 15 minutes.</p>
                    </div>
                    <p>If you did not request this, please ignore this email.</p>
                    <hr/>
                    <p style="color: #6b7280; font-size: 12px;">AutoWash Pro - Smart Car Wash Management System</p>
                </div>
                """.formatted(fullName, token);
        sendEmail(to, subject, html);
    }

    @Override
    @Async
    public void sendTierUpgradedEmail(String to, String fullName, String oldTier, String newTier) {
        String subject = "[AutoWash Pro] Congratulations! You've been upgraded to " + newTier + " tier!";
        String html = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #d97706;">🎉 Tier Upgraded!</h2>
                    <p>Dear %s,</p>
                    <p>Congratulations! You have been upgraded to a higher membership tier.</p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                        <p><strong>Previous Tier:</strong> %s</p>
                        <p><strong>New Tier:</strong> %s 🌟</p>
                    </div>
                    <p>Enjoy your new benefits and keep washing!</p>
                    <hr/>
                    <p style="color: #6b7280; font-size: 12px;">AutoWash Pro - Smart Car Wash Management System</p>
                </div>
                """.formatted(fullName, oldTier, newTier);
        sendEmail(to, subject, html);
    }

    // ===================== ADMIN TEST =====================

    @Override
    public void sendTestEmail(String to) {
        String subject = "[AutoWash Pro] Test Email";
        String html = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">✅ Email Config Working!</h2>
                    <p>This is a test email from AutoWash Pro system.</p>
                    <p>If you receive this, your email configuration is working correctly.</p>
                    <hr/>
                    <p style="color: #6b7280; font-size: 12px;">AutoWash Pro - Smart Car Wash Management System</p>
                </div>
                """;
        sendEmail(to, subject, html);
    }

    // ===================== HELPERS =====================

    private String getCustomerEmail(Booking booking) {
        if (booking.getCustomerId() == null) {
            return null;
        }
        return getUserEmail(booking.getCustomerId());
    }

    private String getUserEmail(Long userId) {
        return userRepository.findById(userId)
                .map(u -> u.getEmail())
                .orElse(null);
    }
}
