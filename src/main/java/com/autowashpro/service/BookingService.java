package com.autowashpro.service;

import com.autowashpro.dto.request.BookingCreateRequest;
import com.autowashpro.dto.request.WalkInBookingCreateRequest;
import com.autowashpro.dto.response.AvailableSlotResponse;
import com.autowashpro.dto.response.BookingResponse;
import com.autowashpro.dto.response.BookingDetailResponse;
import com.autowashpro.dto.response.BookingSummaryResponse;
import com.autowashpro.dto.response.WalkInCustomerLookupResponse;
import com.autowashpro.dto.request.StartServiceRequest;
import com.autowashpro.dto.request.CompleteBookingServiceStepRequest;
import com.autowashpro.dto.request.ReopenBookingServiceStepRequest;
import com.autowashpro.dto.response.BookingServiceStepResponse;
import com.autowashpro.dto.request.MarkBookingPaidRequest;
import com.autowashpro.dto.request.UpdatePaymentMethodRequest;

import java.time.LocalDate;
import java.util.List;

public interface BookingService {

        AvailableSlotResponse getAvailableSlots(
                        Long garageId,
                        Long servicePackageId,
                        String vehicleType,
                        LocalDate date,
                        boolean isWalkIn);

        BookingResponse createBooking(BookingCreateRequest request, Long customerId);

        BookingResponse createWalkInBooking(WalkInBookingCreateRequest request, Long staffUserId);

        WalkInCustomerLookupResponse lookupWalkInCustomerByPhone(String phone, String licensePlate);

        // ===================== ISSUE #13 =====================

        List<BookingSummaryResponse> getCustomerBookings(
                        Long customerId,
                        String status);

        BookingResponse getCustomerBookingDetail(
                        Long bookingId,
                        Long customerId);

        List<BookingSummaryResponse> getStaffBookings(
                        Long staffUserId,
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
                        String note);

        // ===================== ISSUE #16 =====================
        BookingResponse startService(
                        Long bookingId,
                        Long staffUserId,
                        StartServiceRequest request);

        // ===================== ISSUE #19 =====================
        BookingResponse cancelBooking(Long bookingId, Long currentUserId, String role, String reason);

        BookingResponse markNoShow(Long bookingId, Long staffUserId, String reason);

        // ===================== ISSUE #17 =====================
        List<BookingServiceStepResponse> getBookingServiceSteps(
                        Long bookingId,
                        Long currentUserId,
                        String role);

        BookingServiceStepResponse completeServiceStep(
                        Long stepId,
                        Long staffUserId,
                        CompleteBookingServiceStepRequest request);

        BookingServiceStepResponse reopenServiceStep(
                        Long stepId,
                        Long staffUserId,
                        ReopenBookingServiceStepRequest request);

        // ===================== ISSUE #18 =====================
        BookingResponse completeService(Long bookingId, Long staffUserId, String role, String note);

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

}
