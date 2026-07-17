package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.common.AuditAction;
import com.autowashpro.common.AuditMetadata;
import com.autowashpro.common.AuditTargetType;
import com.autowashpro.dto.request.BookingCreateRequest;
import com.autowashpro.dto.request.WalkInBookingCreateRequest;
import com.autowashpro.dto.response.AvailableSlotResponse;
import com.autowashpro.dto.response.BookingResponse;
import com.autowashpro.dto.response.BookingSummaryResponse;
import com.autowashpro.dto.response.WalkInCustomerLookupResponse;
import com.autowashpro.service.BookingService;
import com.autowashpro.service.AuditLogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import com.autowashpro.dto.request.BookingCheckInRequest;
import java.util.List;
import com.autowashpro.dto.request.StartServiceRequest;
import java.time.LocalDate;
import com.autowashpro.dto.request.CancelBookingRequest;
import com.autowashpro.dto.request.CompleteBookingServiceStepRequest;
import com.autowashpro.dto.request.CompleteServiceRequest;
import com.autowashpro.dto.request.MarkBookingPaidRequest;
import com.autowashpro.dto.request.UpdatePaymentMethodRequest;
import com.autowashpro.dto.request.NoShowBookingRequest;
import com.autowashpro.dto.request.ReopenBookingServiceStepRequest;
import com.autowashpro.dto.response.BookingServiceStepResponse;
import com.autowashpro.dto.response.CreatePayOSPaymentResponse;
import com.autowashpro.dto.response.PaymentTransactionResponse;
import com.autowashpro.service.PaymentService;
import org.springframework.security.core.Authentication;

@RestController
@RequestMapping("/bookings")
@RequiredArgsConstructor
public class BookingController {

        private final BookingService bookingService;
        private final AuditLogService auditLogService;
        private final PaymentService paymentService;

        @GetMapping("/available-slots")
        public ApiResponse<AvailableSlotResponse> getAvailableSlots(
                        @RequestParam("garage_id") Long garageId,
                        @RequestParam("service_package_id") Long servicePackageId,
                        @RequestParam("vehicle_type") String vehicleType,
                        @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                        @RequestParam(value = "is_walk_in", required = false, defaultValue = "false") boolean isWalkIn) {

                return ApiResponse.<AvailableSlotResponse>builder()
                                .success(true)
                                .message("Available slots retrieved")
                                .data(bookingService.getAvailableSlots(garageId, servicePackageId, vehicleType, date, isWalkIn))
                                .build();
        }

        @PostMapping
        @PreAuthorize("hasRole('CUSTOMER')")
        public ApiResponse<BookingResponse> createBooking(
                        @Valid @RequestBody BookingCreateRequest request,
                        @AuthenticationPrincipal UserDetails userDetails) {

                Long customerId = Long.valueOf(userDetails.getUsername());
                BookingResponse response = bookingService.createBooking(request, customerId);
                auditLogService.createAuditLog(
                                customerId,
                                AuditAction.BOOKING_CREATED,
                                AuditTargetType.BOOKING,
                                response.getId(),
                                AuditMetadata.of("status", response.getStatus()));
                return ApiResponse.<BookingResponse>builder()
                                .success(true)
                                .message("Booking created successfully")
                                .data(response)
                                .build();
        }

        @PostMapping("/walk-in")
        @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
        public ApiResponse<BookingResponse> createWalkInBooking(
                        @Valid @RequestBody WalkInBookingCreateRequest request,
                        @AuthenticationPrincipal UserDetails userDetails) {

                Long staffUserId = Long.valueOf(userDetails.getUsername());
                BookingResponse response = bookingService.createWalkInBooking(request, staffUserId);
                auditLogService.createAuditLog(
                                staffUserId,
                                AuditAction.BOOKING_WALK_IN_CREATED,
                                AuditTargetType.BOOKING,
                                response.getId(),
                                AuditMetadata.of("status", response.getStatus()));
                return ApiResponse.<BookingResponse>builder()
                                .success(true)
                                .message("Walk-in booking created successfully")
                                .data(response)
                                .build();
        }

        @PostMapping("/guest")
        public ApiResponse<BookingResponse> createGuestBooking(
                        @Valid @RequestBody WalkInBookingCreateRequest request) {

                BookingResponse response = bookingService.createGuestBooking(request);
                auditLogService.createAuditLog(
                                null,
                                AuditAction.BOOKING_GUEST_CREATED,
                                AuditTargetType.BOOKING,
                                response.getId(),
                                AuditMetadata.of("status", response.getStatus()));
                return ApiResponse.<BookingResponse>builder()
                                .success(true)
                                .message("Guest booking created successfully")
                                .data(response)
                                .build();
        }

        @GetMapping("/walk-in/customer-lookup")
        @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
        public ApiResponse<WalkInCustomerLookupResponse> lookupWalkInCustomer(
                        @RequestParam String phone,
                        @RequestParam(required = false) String licensePlate) {

                return ApiResponse.<WalkInCustomerLookupResponse>builder()
                                .success(true)
                                .message("Walk-in customer lookup completed")
                                .data(bookingService.lookupWalkInCustomerByPhone(phone, licensePlate))
                                .build();
        }

        @GetMapping
        @PreAuthorize("hasRole('CUSTOMER')")
        public ApiResponse<List<BookingSummaryResponse>> getCustomerBookings(
                        @AuthenticationPrincipal UserDetails userDetails,
                        @RequestParam(required = false) String status) {

                Long customerId = Long.valueOf(userDetails.getUsername());

                return ApiResponse.<List<BookingSummaryResponse>>builder()
                                .success(true)
                                .message("Customer bookings retrieved")
                                .data(
                                                bookingService.getCustomerBookings(
                                                                customerId,
                                                                status))
                                .build();
        }

        @GetMapping("/{id}")
        @PreAuthorize("hasRole('CUSTOMER')")
        public ApiResponse<BookingResponse> getCustomerBookingDetail(
                        @PathVariable Long id,
                        @AuthenticationPrincipal UserDetails userDetails) {

                Long customerId = Long.valueOf(userDetails.getUsername());

                return ApiResponse.<BookingResponse>builder()
                                .success(true)
                                .message("Booking detail retrieved")
                                .data(
                                                bookingService.getCustomerBookingDetail(
                                                                id,
                                                                customerId))
                                .build();
        }

        @GetMapping("/staff/bookings")
        @PreAuthorize("hasRole('STAFF')")
        public ApiResponse<List<BookingSummaryResponse>> getStaffBookings(

                        @AuthenticationPrincipal UserDetails userDetails,

                        @RequestParam(required = false) String status,

                        @RequestParam(required = false)

                        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)

                        LocalDate date) {

                Long staffUserId = Long.valueOf(userDetails.getUsername());

                return ApiResponse.<List<BookingSummaryResponse>>builder()
                                .success(true)
                                .message("Staff bookings retrieved")
                                .data(
                                                bookingService.getStaffBookings(
                                                                staffUserId,
                                                                status,
                                                                date))
                                .build();
        }

        @GetMapping("/admin/bookings")
        @PreAuthorize("hasRole('ADMIN')")
        public ApiResponse<List<BookingSummaryResponse>> getAdminBookings(

                        @RequestParam(required = false) Long garageId,

                        @RequestParam(required = false) String status,

                        @RequestParam(required = false) String paymentStatus) {

                return ApiResponse.<List<BookingSummaryResponse>>builder()
                                .success(true)
                                .message("Admin bookings retrieved")
                                .data(
                                                bookingService.getAdminBookings(
                                                                garageId,
                                                                status,
                                                                paymentStatus))
                                .build();
        }

        @PatchMapping("/{id}/check-in")
        @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
        public ApiResponse<BookingResponse> checkInBooking(

                        @PathVariable Long id,

                        @RequestBody BookingCheckInRequest request,

                        @AuthenticationPrincipal UserDetails userDetails) {

                Long staffUserId = Long.valueOf(userDetails.getUsername());
                String role = userDetails.getAuthorities().iterator().next().getAuthority();
                BookingResponse response = bookingService.checkInBooking(id, staffUserId, role, request.getNote());
                auditLogService.createAuditLog(
                                staffUserId,
                                AuditAction.BOOKING_CHECKED_IN,
                                AuditTargetType.BOOKING,
                                id,
                                AuditMetadata.of("status", response.getStatus(), "note", request.getNote()));

                return ApiResponse.<BookingResponse>builder()
                                .success(true)
                                .message("Booking checked in successfully")
                                .data(response)
                                .build();
        }

        @PatchMapping("/{id}/start-service")
        @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
        public ApiResponse<BookingResponse> startService(

                        @PathVariable Long id,

                        @AuthenticationPrincipal UserDetails userDetails,

                        @RequestBody StartServiceRequest request) {

                Long staffUserId = Long.valueOf(userDetails.getUsername());
                String role = userDetails.getAuthorities().iterator().next().getAuthority();
                BookingResponse response = bookingService.startService(id, staffUserId, role, request);
                auditLogService.createAuditLog(
                                staffUserId,
                                AuditAction.BOOKING_SERVICE_STARTED,
                                AuditTargetType.BOOKING,
                                id,
                                AuditMetadata.of("status", response.getStatus()));

                return ApiResponse.<BookingResponse>builder()
                                .success(true)
                                .message("Service started successfully")
                                .data(response)
                                .build();
        }

        @PatchMapping("/{id}/cancel")
        @PreAuthorize("hasRole('CUSTOMER') or hasRole('STAFF') or hasRole('ADMIN')")
        public ApiResponse<BookingResponse> cancelBooking(
                        @PathVariable Long id,
                        @RequestBody(required = false) CancelBookingRequest request,
                        @AuthenticationPrincipal UserDetails userDetails) {

                Long currentUserId = Long.valueOf(userDetails.getUsername());
                String role = userDetails.getAuthorities().iterator().next().getAuthority();
                String reason = request != null ? request.getReason() : null;
                BookingResponse response = bookingService.cancelBooking(id, currentUserId, role, reason);
                auditLogService.createAuditLog(
                                currentUserId,
                                AuditAction.BOOKING_CANCELLED,
                                AuditTargetType.BOOKING,
                                id,
                                AuditMetadata.of("status", response.getStatus(), "reason", reason));

                return ApiResponse.<BookingResponse>builder()
                                .success(true)
                                .message("Booking cancelled successfully")
                                .data(response)
                                .build();
        }

        @PatchMapping("/{id}/no-show")
        @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
        public ApiResponse<BookingResponse> markNoShow(
                        @PathVariable Long id,
                        @RequestBody(required = false) NoShowBookingRequest request,
                        @AuthenticationPrincipal UserDetails userDetails) {

                Long staffUserId = Long.valueOf(userDetails.getUsername());
                String reason = request != null ? request.getReason() : null;
                BookingResponse response = bookingService.markNoShow(id, staffUserId, reason);
                auditLogService.createAuditLog(
                                staffUserId,
                                AuditAction.BOOKING_MARKED_NO_SHOW,
                                AuditTargetType.BOOKING,
                                id,
                                AuditMetadata.of("status", response.getStatus(), "reason", reason));

                return ApiResponse.<BookingResponse>builder()
                                .success(true)
                                .message("Booking marked as no-show successfully")
                                .data(response)
                                .build();
        }

        @GetMapping("/{bookingId}/service-steps")
        @PreAuthorize("hasRole('CUSTOMER') or hasRole('STAFF') or hasRole('ADMIN')")
        public ApiResponse<List<BookingServiceStepResponse>> getBookingServiceSteps(
                        @PathVariable Long bookingId,
                        @AuthenticationPrincipal UserDetails userDetails,
                        Authentication authentication) {

                Long currentUserId = Long.valueOf(userDetails.getUsername());

                String role = authentication.getAuthorities()
                                .stream()
                                .findFirst()
                                .orElseThrow()
                                .getAuthority()
                                .replace("ROLE_", "");

                return ApiResponse.<List<BookingServiceStepResponse>>builder()
                                .success(true)
                                .message("Booking service steps retrieved successfully")
                                .data(
                                                bookingService.getBookingServiceSteps(
                                                                bookingId,
                                                                currentUserId,
                                                                role))
                                .build();
        }

        @PatchMapping("/booking-service-steps/{stepId}/complete")
        @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
        public ApiResponse<BookingServiceStepResponse> completeServiceStep(
                        @PathVariable Long stepId,
                        @Valid @RequestBody CompleteBookingServiceStepRequest request,
                        @AuthenticationPrincipal UserDetails userDetails) {

                Long staffUserId = Long.valueOf(userDetails.getUsername());
                BookingServiceStepResponse response = bookingService.completeServiceStep(stepId, staffUserId, request);
                auditLogService.createAuditLog(
                                staffUserId,
                                AuditAction.BOOKING_SERVICE_STEP_COMPLETED,
                                AuditTargetType.BOOKING_SERVICE_STEP,
                                stepId,
                                AuditMetadata.of("status", response.getStatus()));

                return ApiResponse.<BookingServiceStepResponse>builder()
                                .success(true)
                                .message("Service step completed successfully")
                                .data(response)
                                .build();
        }

        @PatchMapping("/booking-service-steps/{stepId}/reopen")
        @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
        public ApiResponse<BookingServiceStepResponse> reopenServiceStep(
                        @PathVariable Long stepId,
                        @Valid @RequestBody ReopenBookingServiceStepRequest request,
                        @AuthenticationPrincipal UserDetails userDetails) {

                Long staffUserId = Long.valueOf(userDetails.getUsername());
                BookingServiceStepResponse response = bookingService.reopenServiceStep(stepId, staffUserId, request);
                auditLogService.createAuditLog(
                                staffUserId,
                                AuditAction.BOOKING_SERVICE_STEP_REOPENED,
                                AuditTargetType.BOOKING_SERVICE_STEP,
                                stepId,
                                AuditMetadata.of("status", response.getStatus()));

                return ApiResponse.<BookingServiceStepResponse>builder()
                                .success(true)
                                .message("Service step reopened successfully")
                                .data(response)
                                .build();
        }

        @PatchMapping("/{id}/complete-service")
        @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
        public ApiResponse<BookingResponse> completeService(
                        @PathVariable Long id,
                        @RequestBody(required = false) CompleteServiceRequest request,
                        @AuthenticationPrincipal UserDetails userDetails) {

                Long staffUserId = Long.valueOf(userDetails.getUsername());
                String role = userDetails.getAuthorities().iterator().next().getAuthority();
                String note = request != null ? request.getNote() : null;
                BookingResponse response = bookingService.completeService(id, staffUserId, role, note);
                auditLogService.createAuditLog(
                                staffUserId,
                                AuditAction.BOOKING_SERVICE_COMPLETED,
                                AuditTargetType.BOOKING,
                                id,
                                AuditMetadata.of("status", response.getStatus(), "note", note));

                return ApiResponse.<BookingResponse>builder()
                                .success(true)
                                .message("Service completed successfully")
                                .data(response)
                                .build();
        }

        @PatchMapping("/{id}/mark-paid")
        @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
        public ApiResponse<BookingResponse> markBookingPaid(
                        @PathVariable Long id,
                        @Valid @RequestBody MarkBookingPaidRequest request,
                        @AuthenticationPrincipal UserDetails userDetails) {

                Long staffUserId = Long.valueOf(userDetails.getUsername());

                String role = userDetails.getAuthorities()
                                .iterator()
                                .next()
                                .getAuthority();
                BookingResponse response = bookingService.markBookingPaid(id, staffUserId, role, request);
                auditLogService.createAuditLog(
                                staffUserId,
                                AuditAction.BOOKING_MARK_PAID,
                                AuditTargetType.BOOKING,
                                id,
                                AuditMetadata.of(
                                                "paymentStatus", response.getPaymentStatus(),
                                                "paymentMethod", response.getPaymentMethod()));

                return ApiResponse.<BookingResponse>builder()
                                .success(true)
                                .message("Booking marked as paid successfully")
                                .data(response)
                                .build();
        }

        @PatchMapping("/{id}/update-payment-method")
        @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
        public ApiResponse<BookingResponse> updatePaymentMethod(
                        @PathVariable Long id,
                        @Valid @RequestBody UpdatePaymentMethodRequest request,
                        @AuthenticationPrincipal UserDetails userDetails) {

                Long staffUserId = Long.valueOf(userDetails.getUsername());

                String role = userDetails.getAuthorities()
                                .iterator()
                                .next()
                                .getAuthority();
                BookingResponse response = bookingService.updatePaymentMethod(id, staffUserId, role, request);
                auditLogService.createAuditLog(
                                staffUserId,
                                AuditAction.BOOKING_PAYMENT_METHOD_UPDATED,
                                AuditTargetType.BOOKING,
                                id,
                                AuditMetadata.of("paymentMethod", response.getPaymentMethod()));

                return ApiResponse.<BookingResponse>builder()
                                .success(true)
                                .message("Payment method updated successfully")
                                .data(response)
                                .build();
        }

        @PostMapping("/{id}/deposit/payment")
        @PreAuthorize("hasRole('CUSTOMER')")
        public ApiResponse<CreatePayOSPaymentResponse> createDepositPayment(
                        @PathVariable Long id,
                        @AuthenticationPrincipal UserDetails userDetails) {

                Long customerId = Long.valueOf(userDetails.getUsername());
                CreatePayOSPaymentResponse response = paymentService.createDepositPayment(id, customerId);
                auditLogService.createAuditLog(
                                customerId,
                                AuditAction.PAYMENT_LINK_CREATED,
                                AuditTargetType.PAYMENT_TRANSACTION,
                                response.getTransactionId(),
                                AuditMetadata.of("bookingId", id, "purpose", "DEPOSIT", "status", response.getStatus()));
                return ApiResponse.<CreatePayOSPaymentResponse>builder()
                                .success(true)
                                .message("Deposit payment link created successfully")
                                .data(response)
                                .build();
        }

        @GetMapping("/{id}/payment-transactions")
        @PreAuthorize("hasRole('CUSTOMER')")
        public ApiResponse<List<PaymentTransactionResponse>> getOwnPaymentTransactions(
                        @PathVariable Long id,
                        @RequestParam(required = false) String purpose,
                        @AuthenticationPrincipal UserDetails userDetails) {

                Long customerId = Long.valueOf(userDetails.getUsername());
                return ApiResponse.<List<PaymentTransactionResponse>>builder()
                                .success(true)
                                .message("Payment transactions retrieved")
                                .data(paymentService.getTransactionsByBookingForCustomer(id, customerId, purpose))
                                .build();
        }
}
