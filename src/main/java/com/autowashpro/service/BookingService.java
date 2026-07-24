package com.autowashpro.service;

import com.autowashpro.dto.request.BookingCreateRequest;
import com.autowashpro.dto.request.WalkInBookingCreateRequest;
import com.autowashpro.dto.request.CareAssignmentRequest;
import com.autowashpro.dto.request.OperationPhaseRequest;
import com.autowashpro.dto.response.AssignedCareStaffResponse;
import com.autowashpro.dto.response.AvailableCareStaffResponse;
import com.autowashpro.dto.response.AvailableSlotResponse;
import com.autowashpro.dto.response.BookingResponse;
import com.autowashpro.dto.response.BookingDetailResponse;
import com.autowashpro.dto.response.BookingSummaryResponse;
import com.autowashpro.dto.response.CareAssignmentStatusResponse;
import com.autowashpro.dto.response.CareTaskResponse;
import com.autowashpro.dto.response.StaffBookingSummaryResponse;
import com.autowashpro.dto.response.StaffCalendarDayResponse;
import com.autowashpro.dto.response.WalkInCustomerLookupResponse;
import com.autowashpro.dto.request.StartServiceRequest;
import com.autowashpro.dto.request.CompleteBookingServiceStepRequest;
import com.autowashpro.dto.request.ReopenBookingServiceStepRequest;
import com.autowashpro.dto.response.BookingServiceStepResponse;
import com.autowashpro.dto.request.MarkBookingPaidRequest;
import com.autowashpro.dto.request.UpdatePaymentMethodRequest;
import com.autowashpro.dto.response.CancellationPreviewResponse;

import java.time.LocalDate;
import java.util.List;

public interface BookingService {

        AvailableSlotResponse getAvailableSlots(
                        Long garageId,
                        Long servicePackageId,
                        String vehicleType,
                        LocalDate date,
                        boolean isWalkIn,
                        List<Long> addOnServicePackageIds);

        BookingResponse createBooking(BookingCreateRequest request, Long customerId);

        BookingResponse createWalkInBooking(WalkInBookingCreateRequest request, Long staffUserId, String role);

        BookingResponse createGuestBooking(WalkInBookingCreateRequest request);

        void checkGuestPhoneEligibility(String phone);

        WalkInCustomerLookupResponse lookupWalkInCustomerByPhone(
                        String phone,
                        String licensePlate,
                        String vehicleType,
                        Long callerId,
                        String role);

        // ===================== ISSUE #13 =====================

        List<BookingSummaryResponse> getCustomerBookings(
                        Long customerId,
                        String status);

        BookingResponse getCustomerBookingDetail(
                        Long bookingId,
                        Long customerId);

        List<BookingSummaryResponse> getStaffBookings(
                        Long staffUserId,
                        String role,
                        String status,
                        LocalDate date);

        List<BookingSummaryResponse> getAdminBookings(
                        Long garageId,
                        String status,
                        String paymentStatus);

        // ===================== ISSUE #14 =====================
        BookingResponse checkInBooking(
                        Long bookingId,
                        Long staffUserId,
                        String role,
                        String note);

        // ===================== ISSUE #16 =====================
        BookingResponse startService(
                        Long bookingId,
                        Long staffUserId,
                        String role,
                        StartServiceRequest request);

        // ===================== ISSUE #19 =====================
        BookingResponse cancelBooking(Long bookingId, Long currentUserId, String role, String reason);

        /**
         * Task 4: Preview refund amount before cancellation — does NOT mutate the booking.
         * Only the owning customer may call this (403 if not owner).
         */
        CancellationPreviewResponse getCancellationPreview(Long bookingId, Long customerId);

        BookingResponse markNoShow(Long bookingId, Long staffUserId, String role, String reason);
        // ===================== ISSUE #54 =====================

        BookingResponse completeManualRefund(
                        Long bookingId,
                        Long staffUserId,
                        String role,
                        String note);

        void expirePendingDeposits();

        List<BookingSummaryResponse> getPendingRefundBookings(
                        Long staffUserId,
                        String role);

        // ===================== ISSUE #17 =====================
        List<BookingServiceStepResponse> getBookingServiceSteps(
                        Long bookingId,
                        Long currentUserId,
                        String role);

        BookingServiceStepResponse completeServiceStep(
                        Long stepId,
                        Long staffUserId,
                        String role,
                        CompleteBookingServiceStepRequest request);

        BookingServiceStepResponse reopenServiceStep(
                        Long stepId,
                        Long staffUserId,
                        String role,
                        ReopenBookingServiceStepRequest request);

        // ===================== ISSUE #18 =====================
        BookingResponse completeService(Long bookingId, Long staffUserId, String role, String note);

        /** Recovery for bookings incorrectly placed at READY_FOR_HANDOVER despite requiring care. */
        BookingResponse recoverCareWorkflow(Long bookingId, Long staffUserId, String role);

        // ===================== ISSUE #20 =====================
        BookingResponse markBookingPaid(
                        Long bookingId,
                        Long staffUserId,
                        String role,
                        MarkBookingPaidRequest request);

        BookingResponse updatePaymentMethod(
                        Long bookingId,
                        Long staffUserId,
                        String role,
                        UpdatePaymentMethodRequest request);

        // ===================== ISSUE #169 Operation Phase =====================

        BookingResponse startWash(Long bookingId, Long staffUserId, String role, OperationPhaseRequest request);

        BookingResponse completeWash(Long bookingId, Long staffUserId, String role, OperationPhaseRequest request);

        BookingResponse startCare(Long bookingId, Long staffUserId, String role, OperationPhaseRequest request);

        BookingResponse completeCare(Long bookingId, Long staffUserId, String role, OperationPhaseRequest request);

        /** Advance booking from FINAL_INSPECTION to READY_FOR_HANDOVER after validating inspections. */
        BookingResponse completeFinalInspection(Long bookingId, Long staffUserId, String role);

        BookingResponse assignCareStaff(Long bookingId, Long staffUserId, String role, CareAssignmentRequest request);

        List<CareTaskResponse> getCareTasksForCurrentStaff(Long careStaffUserId, String status, LocalDate date, int page, int limit);

        /**
         * Reserve care staff for a booking that requires it, if not already reserved.
         * Called after a DEPOSIT webhook confirms the booking.
         * This method is idempotent — safe to call multiple times.
         */
        void reserveCareStaffIfNeeded(Long bookingId);

        // ===================== ISSUE #169 Care Staff — new endpoints =====================

        List<AvailableCareStaffResponse> getAvailableCareStaff(Long bookingId, Long userId, String role);

        CareAssignmentStatusResponse getCareAssignmentStatus(Long bookingId, Long userId, String role);

        List<AssignedCareStaffResponse> getAssignedCareStaff(Long bookingId, Long userId, String role);

        // ===================== Staff Booking Summary =====================

        StaffBookingSummaryResponse getStaffBookingSummary(Long staffUserId, String role);

        List<StaffCalendarDayResponse> getStaffCalendar(Long staffUserId, String role, int year, int month);

}
