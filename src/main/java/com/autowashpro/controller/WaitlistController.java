package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.request.CreateWaitlistRequest;
import com.autowashpro.dto.response.WaitlistResponse;
import com.autowashpro.service.WaitlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class WaitlistController {

    private final WaitlistService waitlistService;

    // ===================== CUSTOMER =====================

    @PostMapping("/waitlist")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<WaitlistResponse> createWaitlist(
            @RequestBody CreateWaitlistRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<WaitlistResponse>builder()
                .success(true)
                .message("Waitlist entry created successfully")
                .data(waitlistService.createWaitlist(request, customerId))
                .build();
    }

    @GetMapping("/waitlist/me")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<Page<WaitlistResponse>> getMyWaitlists(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<Page<WaitlistResponse>>builder()
                .success(true)
                .message("Waitlist entries retrieved successfully")
                .data(waitlistService.getMyWaitlists(customerId, page, limit))
                .build();
    }

    @GetMapping("/waitlist/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<WaitlistResponse> getMyWaitlistDetail(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<WaitlistResponse>builder()
                .success(true)
                .message("Waitlist entry retrieved successfully")
                .data(waitlistService.getMyWaitlistDetail(id, customerId))
                .build();
    }

    @PatchMapping("/waitlist/{id}/cancel")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<WaitlistResponse> cancelWaitlist(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<WaitlistResponse>builder()
                .success(true)
                .message("Waitlist entry canceled successfully")
                .data(waitlistService.cancelWaitlist(id, customerId))
                .build();
    }

    @PatchMapping("/waitlist/{id}/accept")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<WaitlistResponse> acceptWaitlistOffer(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long customerId = Long.valueOf(userDetails.getUsername());
        return ApiResponse.<WaitlistResponse>builder()
                .success(true)
                .message("Waitlist offer accepted successfully")
                .data(waitlistService.acceptWaitlistOffer(id, customerId))
                .build();
    }

    // ===================== ADMIN / STAFF =====================

    @GetMapping("/admin/waitlist")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public ApiResponse<Page<WaitlistResponse>> getAdminWaitlists(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) Long garageId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {
        Long userId = Long.valueOf(userDetails.getUsername());
        String role = userDetails.getAuthorities().iterator().next().getAuthority();
        return ApiResponse.<Page<WaitlistResponse>>builder()
                .success(true)
                .message("Waitlist entries retrieved successfully")
                .data(waitlistService.getAdminWaitlists(garageId, status, userId, role, page, limit))
                .build();
    }

    @PatchMapping("/admin/waitlist/{id}/offer")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public ApiResponse<WaitlistResponse> offerWaitlist(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.valueOf(userDetails.getUsername());
        String role = userDetails.getAuthorities().iterator().next().getAuthority();
        return ApiResponse.<WaitlistResponse>builder()
                .success(true)
                .message("Waitlist offer sent successfully")
                .data(waitlistService.offerWaitlist(id, userId, role))
                .build();
    }

    @PatchMapping("/admin/waitlist/{id}/expire")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public ApiResponse<WaitlistResponse> expireWaitlist(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.valueOf(userDetails.getUsername());
        String role = userDetails.getAuthorities().iterator().next().getAuthority();
        return ApiResponse.<WaitlistResponse>builder()
                .success(true)
                .message("Waitlist entry expired successfully")
                .data(waitlistService.expireWaitlist(id, userId, role))
                .build();
    }
}