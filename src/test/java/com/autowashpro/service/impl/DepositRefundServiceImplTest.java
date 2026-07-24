package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CreateDepositRefundRequest;
import com.autowashpro.dto.request.ExecuteDepositRefundRequest;
import com.autowashpro.dto.request.RejectDepositRefundRequest;
import com.autowashpro.dto.response.DepositRefundResponse;
import com.autowashpro.entity.BankAccount;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.DepositRefund;
import com.autowashpro.repository.BankAccountRepository;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.DepositRefundRepository;
import com.autowashpro.service.AuditLogService;
import com.autowashpro.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DepositRefundServiceImplTest {

    private static final Long BOOKING_ID = 10L;
    private static final Long CUSTOMER_ID = 20L;
    private static final Long ADMIN_ID = 30L;
    private static final Long REFUND_ID = 40L;

    @Mock private DepositRefundRepository depositRefundRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private BankAccountRepository bankAccountRepository;
    @Mock private AuditLogService auditLogService;
    @Mock private NotificationService notificationService;

    @InjectMocks private DepositRefundServiceImpl service;

    @BeforeEach
    void setUp() {
        lenient().when(depositRefundRepository.save(any(DepositRefund.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(bookingRepository.save(any(Booking.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createRequestLocksBookingAndSnapshotsBankAccount() {
        Booking booking = refundableBooking();
        BankAccount account = activeBankAccount();
        CreateDepositRefundRequest request = new CreateDepositRefundRequest();
        request.setBankAccountId(account.getId());

        when(bookingRepository.findByIdWithLock(BOOKING_ID)).thenReturn(Optional.of(booking));
        when(depositRefundRepository.findFirstByBookingIdAndStatusInOrderByRequestedAtDesc(eq(BOOKING_ID), any()))
                .thenReturn(Optional.empty());
        when(bankAccountRepository.findByIdAndCustomer_Id(account.getId(), CUSTOMER_ID))
                .thenReturn(Optional.of(account));

        DepositRefundResponse response = service.createRequest(BOOKING_ID, CUSTOMER_ID, request);

        assertEquals("REQUESTED", response.getStatus());
        assertEquals("VCB", response.getBankName());
        assertEquals(new BigDecimal("45.00"), response.getRequestedAmount());
        verify(bookingRepository).findByIdWithLock(BOOKING_ID);
    }

    @Test
    void createRequestRejectsSecondOpenRequest() {
        Booking booking = refundableBooking();
        CreateDepositRefundRequest request = new CreateDepositRefundRequest();
        request.setBankAccountId(1L);
        when(bookingRepository.findByIdWithLock(BOOKING_ID)).thenReturn(Optional.of(booking));
        when(depositRefundRepository.findFirstByBookingIdAndStatusInOrderByRequestedAtDesc(eq(BOOKING_ID), any()))
                .thenReturn(Optional.of(refund("REQUESTED")));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createRequest(BOOKING_ID, CUSTOMER_ID, request));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(depositRefundRepository, never()).save(any());
    }

    @Test
    void approveRejectsStaleBookingState() {
        DepositRefund refund = refund("REQUESTED");
        Booking booking = refundableBooking();
        booking.setDepositStatus("REFUNDED");
        when(depositRefundRepository.findByIdWithLock(REFUND_ID)).thenReturn(Optional.of(refund));
        when(bookingRepository.findByIdWithLock(BOOKING_ID)).thenReturn(Optional.of(booking));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.approve(REFUND_ID, ADMIN_ID));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verify(depositRefundRepository, never()).save(any());
    }

    @Test
    void executeSuccessRequiresTransactionReference() {
        when(depositRefundRepository.findByIdWithLock(REFUND_ID)).thenReturn(Optional.of(refund("APPROVED")));
        when(bookingRepository.findByIdWithLock(BOOKING_ID)).thenReturn(Optional.of(refundableBooking()));
        ExecuteDepositRefundRequest request = new ExecuteDepositRefundRequest();
        request.setSuccess(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.execute(REFUND_ID, ADMIN_ID, request));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void executeSuccessPersistsReferenceAndCompletesBookingRefund() {
        DepositRefund refund = refund("APPROVED");
        Booking booking = refundableBooking();
        when(depositRefundRepository.findByIdWithLock(REFUND_ID)).thenReturn(Optional.of(refund));
        when(bookingRepository.findByIdWithLock(BOOKING_ID)).thenReturn(Optional.of(booking));
        ExecuteDepositRefundRequest request = new ExecuteDepositRefundRequest();
        request.setSuccess(true);
        request.setTransactionReference(" TX-123 ");

        DepositRefundResponse response = service.execute(REFUND_ID, ADMIN_ID, request);

        assertEquals("REFUNDED", response.getStatus());
        assertEquals("TX-123", response.getTransactionReference());
        assertEquals("REFUNDED", booking.getDepositStatus());
        verify(notificationService).notifyDepositRefundCompleted(CUSTOMER_ID, BOOKING_ID, new BigDecimal("45.00"));
    }

    @Test
    void executeFailureLeavesBookingEligibleForRetry() {
        DepositRefund refund = refund("APPROVED");
        Booking booking = refundableBooking();
        when(depositRefundRepository.findByIdWithLock(REFUND_ID)).thenReturn(Optional.of(refund));
        when(bookingRepository.findByIdWithLock(BOOKING_ID)).thenReturn(Optional.of(booking));
        ExecuteDepositRefundRequest request = new ExecuteDepositRefundRequest();
        request.setSuccess(false);
        request.setNote("Bank rejected transfer");

        DepositRefundResponse response = service.execute(REFUND_ID, ADMIN_ID, request);

        assertEquals("FAILED", response.getStatus());
        assertEquals("REFUND_PENDING", booking.getDepositStatus());
        verify(notificationService, never()).notifyDepositRefundCompleted(any(), any(), any());
    }

    @Test
    void executeAlreadyRefundedIsIdempotent() {
        DepositRefund refund = refund("REFUNDED");
        refund.setTransactionReference("TX-OLD");
        when(depositRefundRepository.findByIdWithLock(REFUND_ID)).thenReturn(Optional.of(refund));
        ExecuteDepositRefundRequest request = new ExecuteDepositRefundRequest();
        request.setSuccess(true);
        request.setTransactionReference("TX-NEW");

        DepositRefundResponse response = service.execute(REFUND_ID, ADMIN_ID, request);

        assertEquals("TX-OLD", response.getTransactionReference());
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void approveDoesNotNotifyCustomer() {
        DepositRefund refund = refund("REQUESTED");
        Booking booking = refundableBooking();
        when(depositRefundRepository.findByIdWithLock(REFUND_ID)).thenReturn(Optional.of(refund));
        when(bookingRepository.findByIdWithLock(BOOKING_ID)).thenReturn(Optional.of(booking));

        DepositRefundResponse response = service.approve(REFUND_ID, ADMIN_ID);

        assertEquals("APPROVED", response.getStatus());
        verify(notificationService, never()).notifyDepositRefundApproved(any(), any(), any());
    }

    @Test
    void rejectNotifiesCustomer() {
        DepositRefund refund = refund("REQUESTED");
        when(depositRefundRepository.findByIdWithLock(REFUND_ID)).thenReturn(Optional.of(refund));
        RejectDepositRefundRequest request = new RejectDepositRefundRequest();
        request.setReason("Insufficient documentation");

        DepositRefundResponse response = service.reject(REFUND_ID, ADMIN_ID, request);

        assertEquals("REJECTED", response.getStatus());
        verify(notificationService).notifyDepositRefundRejected(any(), any(), any());
    }

    @Test
    void rejectIdempotentSkipsNotification() {
        DepositRefund refund = refund("REJECTED");
        when(depositRefundRepository.findByIdWithLock(REFUND_ID)).thenReturn(Optional.of(refund));
        RejectDepositRefundRequest request = new RejectDepositRefundRequest();
        request.setReason("Already rejected");

        DepositRefundResponse response = service.reject(REFUND_ID, ADMIN_ID, request);

        assertEquals("REJECTED", response.getStatus());
        verify(notificationService, never()).notifyDepositRefundRejected(any(), any(), any());
    }

    @Test
    void adminListRejectsInvalidLimitAndStatus() {
        ResponseStatusException limitError = assertThrows(ResponseStatusException.class,
                () -> service.listForAdmin(1, 0, null));
        ResponseStatusException statusError = assertThrows(ResponseStatusException.class,
                () -> service.listForAdmin(1, 10, "MADE_UP"));

        assertEquals(HttpStatus.BAD_REQUEST, limitError.getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, statusError.getStatusCode());
    }

    private Booking refundableBooking() {
        Booking booking = new Booking();
        booking.setId(BOOKING_ID);
        booking.setCustomerId(CUSTOMER_ID);
        booking.setStatus("CANCELED");
        booking.setDepositStatus("REFUND_PENDING");
        booking.setRefundAmount(new BigDecimal("45.00"));
        return booking;
    }

    private DepositRefund refund(String status) {
        DepositRefund refund = new DepositRefund();
        refund.setId(REFUND_ID);
        refund.setBookingId(BOOKING_ID);
        refund.setCustomerId(CUSTOMER_ID);
        refund.setBankAccountId(50L);
        refund.setBankName("VCB");
        refund.setAccountNumber("0123456789");
        refund.setAccountHolderName("NGUYEN VAN A");
        refund.setRequestedAmount(new BigDecimal("45.00"));
        refund.setStatus(status);
        return refund;
    }

    private BankAccount activeBankAccount() {
        BankAccount account = new BankAccount();
        account.setId(50L);
        account.setBankName("VCB");
        account.setBankCode("VCB");
        account.setAccountNumber("0123456789");
        account.setAccountHolderName("NGUYEN VAN A");
        account.setIsActive(true);
        return account;
    }
}
