package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.common.AuditAction;
import com.autowashpro.common.AuditTargetType;
import com.autowashpro.dto.request.BookingCreateRequest;
import com.autowashpro.dto.request.MarkBookingPaidRequest;
import com.autowashpro.dto.response.BookingResponse;
import com.autowashpro.service.AuditLogService;
import com.autowashpro.service.BookingService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingControllerAuditTest {

    @Mock
    private BookingService bookingService;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private BookingController bookingController;

    @Test
    void createBookingWritesCustomerAuditLog() {
        BookingCreateRequest request = new BookingCreateRequest();
        UserDetails customer = user("4", "CUSTOMER");
        when(bookingService.createBooking(request, 4L)).thenReturn(BookingResponse.builder()
                .id(20L)
                .status("CONFIRMED")
                .build());

        ApiResponse<BookingResponse> response = bookingController.createBooking(request, customer);

        assertEquals(20L, response.getData().getId());
        verify(auditLogService).createAuditLog(
                eq(4L),
                eq(AuditAction.BOOKING_CREATED),
                eq(AuditTargetType.BOOKING),
                eq(20L),
                any());
    }

    @Test
    void markPaidWritesExpectedAuditAction() {
        MarkBookingPaidRequest request = new MarkBookingPaidRequest();
        UserDetails staff = user("5", "STAFF");
        when(bookingService.markBookingPaid(20L, 5L, "ROLE_STAFF", request)).thenReturn(BookingResponse.builder()
                .id(20L)
                .paymentStatus("PAID")
                .paymentMethod("CASH")
                .build());

        bookingController.markBookingPaid(20L, request, staff);

        verify(auditLogService).createAuditLog(
                eq(5L),
                eq(AuditAction.BOOKING_MARK_PAID),
                eq(AuditTargetType.BOOKING),
                eq(20L),
                any());
    }

    private UserDetails user(String id, String role) {
        return User.withUsername(id).password("test").roles(role).build();
    }
}
