package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.request.TestEmailRequest;
import com.autowashpro.service.EmailService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/notifications")
@RequiredArgsConstructor
public class EmailController {

    private final EmailService emailService;

    @PostMapping("/test-email")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<String> sendTestEmail(@Valid @RequestBody TestEmailRequest request) {
        emailService.sendTestEmail(request.getEmail());
        return ApiResponse.<String>builder()
                .success(true)
                .message("Test email sent to " + request.getEmail())
                .data(null)
                .build();
    }
    @PostMapping("/test-reminder/{bookingId}")
@PreAuthorize("hasRole('ADMIN')")
public ApiResponse<String> sendTestReminder(@PathVariable Long bookingId) {
    emailService.sendBookingReminderEmail(bookingId);
    return ApiResponse.<String>builder()
            .success(true)
            .message("Reminder email sent for booking #" + bookingId)
            .data(null)
            .build();
}
}