package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.response.NotificationResponse;
import com.autowashpro.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    // GET /notifications?page=1&limit=10&isRead=false
    @GetMapping
    @PreAuthorize("hasAnyRole('CUSTOMER','STAFF','ADMIN')")
    public ApiResponse<Page<NotificationResponse>> getMyNotifications(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) Boolean isRead,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {
        Long userId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<Page<NotificationResponse>>builder()
                .success(true)
                .message("Notifications retrieved successfully")
                .data(notificationService.getMyNotifications(userId, isRead, page, limit))
                .build();
    }

    // GET /notifications/:id
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('CUSTOMER','STAFF','ADMIN')")
    public ApiResponse<NotificationResponse> getMyNotificationDetail(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<NotificationResponse>builder()
                .success(true)
                .message("Notification retrieved successfully")
                .data(notificationService.getMyNotificationDetail(id, userId))
                .build();
    }

    // PATCH /notifications/:id/read
    @PatchMapping("/{id}/read")
    @PreAuthorize("hasAnyRole('CUSTOMER','STAFF','ADMIN')")
    public ApiResponse<NotificationResponse> markAsRead(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<NotificationResponse>builder()
                .success(true)
                .message("Notification marked as read")
                .data(notificationService.markAsRead(id, userId))
                .build();
    }

    // PATCH /notifications/read-all
    @PatchMapping("/read-all")
    @PreAuthorize("hasAnyRole('CUSTOMER','STAFF','ADMIN')")
    public ApiResponse<Integer> markAllAsRead(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.valueOf(userDetails.getUsername());
        int count = notificationService.markAllAsRead(userId);
        return ApiResponse.<Integer>builder()
                .success(true)
                .message("Marked " + count + " notifications as read")
                .data(count)
                .build();
    }

    // DELETE /notifications/:id
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('CUSTOMER','STAFF','ADMIN')")
    public void deleteNotification(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.valueOf(userDetails.getUsername());
        notificationService.deleteNotification(id, userId);
    }
}