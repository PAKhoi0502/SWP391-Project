package com.autowashpro.service.impl;

import com.autowashpro.common.AuditAction;
import com.autowashpro.common.AuditMetadata;
import com.autowashpro.common.AuditTargetType;
import com.autowashpro.dto.request.CreateDepositRefundRequest;
import com.autowashpro.dto.request.ExecuteDepositRefundRequest;
import com.autowashpro.dto.request.RejectDepositRefundRequest;
import com.autowashpro.dto.response.DepositRefundEligibilityResponse;
import com.autowashpro.dto.response.DepositRefundResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.entity.BankAccount;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.DepositRefund;
import com.autowashpro.repository.BankAccountRepository;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.DepositRefundRepository;
import com.autowashpro.service.AuditLogService;
import com.autowashpro.service.DepositRefundService;
import com.autowashpro.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DepositRefundServiceImpl implements DepositRefundService {

    private static final List<String> OPEN_STATUSES = List.of("REQUESTED", "APPROVED", "PROCESSING");
    private static final Set<String> VALID_STATUSES = Set.of(
            "REQUESTED", "APPROVED", "REJECTED", "PROCESSING", "REFUNDED", "FAILED", "CANCELED");

    private final DepositRefundRepository depositRefundRepository;
    private final BookingRepository bookingRepository;
    private final BankAccountRepository bankAccountRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;

    @Override
    public DepositRefundEligibilityResponse getEligibility(Long bookingId, Long customerId) {
        Booking booking = loadOwnedBooking(bookingId, customerId);
        return evaluateEligibility(booking);
    }

    @Override
    @Transactional
    public DepositRefundResponse createRequest(Long bookingId, Long customerId, CreateDepositRefundRequest request) {
        // Serialize requests for the same booking so two quick clicks cannot create
        // two simultaneously open refund requests.
        Booking booking = loadOwnedBookingForUpdate(bookingId, customerId);
        DepositRefundEligibilityResponse eligibility = evaluateEligibility(booking);
        if (!eligibility.isEligible()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, eligibility.getMessage());
        }

        BankAccount bankAccount = bankAccountRepository
                .findByIdAndCustomer_Id(request.getBankAccountId(), customerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bank account not found"));
        if (!Boolean.TRUE.equals(bankAccount.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bank account is not active");
        }

        DepositRefund refund = new DepositRefund();
        refund.setBookingId(booking.getId());
        refund.setCustomerId(customerId);
        refund.setBankAccountId(bankAccount.getId());
        refund.setBankName(bankAccount.getBankName());
        refund.setAccountNumber(bankAccount.getAccountNumber());
        refund.setAccountHolderName(bankAccount.getAccountHolderName());
        refund.setRequestedAmount(booking.getRefundAmount());
        refund.setStatus("REQUESTED");
        refund.setRequestedAt(LocalDateTime.now());

        DepositRefund saved = depositRefundRepository.save(refund);

        auditLogService.createAuditLog(customerId, AuditAction.DEPOSIT_REFUND_REQUESTED, AuditTargetType.DEPOSIT_REFUND,
                saved.getId(), AuditMetadata.of("bookingId", bookingId, "amount", saved.getRequestedAmount()));

        return toResponse(saved);
    }

    @Override
    public List<DepositRefundResponse> listOwn(Long customerId) {
        return depositRefundRepository.findByCustomerIdOrderByRequestedAtDesc(customerId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public DepositRefundResponse getOwnById(Long refundId, Long customerId) {
        DepositRefund refund = loadRefund(refundId);
        if (!refund.getCustomerId().equals(customerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This refund request does not belong to you");
        }
        return toResponse(refund);
    }

    @Override
    public PageResponse<DepositRefundResponse> listForAdmin(int page, int limit, String status) {
        int safePage = Math.max(page, 1);
        if (limit < 1 || limit > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "limit must be between 1 and 100");
        }

        String normalizedStatus = normalizeStatus(status);
        PageRequest pageable = PageRequest.of(safePage - 1, limit);
        Page<DepositRefund> result = normalizedStatus != null
                ? depositRefundRepository.findByStatusOrderByRequestedAtDesc(normalizedStatus, pageable)
                : depositRefundRepository.findAllByOrderByRequestedAtDesc(pageable);

        return PageResponse.<DepositRefundResponse>builder()
                .data(result.getContent().stream().map(this::toResponse).toList())
                .page(safePage)
                .limit(limit)
                .totalItems(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .build();
    }

    @Override
    public DepositRefundResponse getByIdForAdmin(Long refundId) {
        return toResponse(loadRefund(refundId));
    }

    @Override
    @Transactional
    public DepositRefundResponse approve(Long refundId, Long adminId) {
        DepositRefund refund = loadRefundForUpdate(refundId);
        if ("APPROVED".equals(refund.getStatus())) {
            return toResponse(refund);
        }
        if (!"REQUESTED".equals(refund.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only REQUESTED refunds can be approved. Current status: " + refund.getStatus());
        }
        Booking booking = loadRefundBookingForUpdate(refund);
        validateBookingStillRefundable(booking, refund);

        refund.setStatus("APPROVED");
        refund.setReviewedBy(adminId);
        refund.setReviewedAt(LocalDateTime.now());
        DepositRefund saved = depositRefundRepository.save(refund);

        auditLogService.createAuditLog(adminId, AuditAction.DEPOSIT_REFUND_APPROVED, AuditTargetType.DEPOSIT_REFUND,
                saved.getId(), AuditMetadata.of("bookingId", saved.getBookingId()));
        // Task 7: No customer notification on approve — only notify when refund is actually transferred (execute)

        return toResponse(saved);
    }

    @Override
    @Transactional
    public DepositRefundResponse reject(Long refundId, Long adminId, RejectDepositRefundRequest request) {
        DepositRefund refund = loadRefundForUpdate(refundId);
        if ("REJECTED".equals(refund.getStatus())) {
            return toResponse(refund);
        }
        if (!"REQUESTED".equals(refund.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only REQUESTED refunds can be rejected. Current status: " + refund.getStatus());
        }
        refund.setStatus("REJECTED");
        refund.setRejectReason(request.getReason());
        refund.setReviewedBy(adminId);
        refund.setReviewedAt(LocalDateTime.now());
        DepositRefund saved = depositRefundRepository.save(refund);

        auditLogService.createAuditLog(adminId, AuditAction.DEPOSIT_REFUND_REJECTED, AuditTargetType.DEPOSIT_REFUND,
                saved.getId(), AuditMetadata.of("bookingId", saved.getBookingId(), "reason", request.getReason()));
        notificationService.notifyDepositRefundRejected(saved.getCustomerId(), saved.getBookingId(), request.getReason());

        return toResponse(saved);
    }

    @Override
    @Transactional
    public DepositRefundResponse execute(Long refundId, Long adminId, ExecuteDepositRefundRequest request) {
        DepositRefund refund = loadRefundForUpdate(refundId);
        if ("REFUNDED".equals(refund.getStatus())) {
            return toResponse(refund);
        }
        if (!"APPROVED".equals(refund.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only APPROVED refunds can be executed. Current status: " + refund.getStatus());
        }

        Booking booking = loadRefundBookingForUpdate(refund);
        validateBookingStillRefundable(booking, refund);

        boolean success = Boolean.TRUE.equals(request.getSuccess());
        String transactionReference = trimToNull(request.getTransactionReference());
        if (success && transactionReference == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Transaction reference is required when the refund transfer succeeds");
        }

        refund.setExecutedBy(adminId);
        refund.setExecutedAt(LocalDateTime.now());
        refund.setAdminNote(trimToNull(request.getNote()));
        refund.setTransactionReference(transactionReference);

        if (success) {
            refund.setStatus("REFUNDED");
            booking.setDepositStatus("REFUNDED");
        } else {
            refund.setStatus("FAILED");
            booking.setDepositStatus("REFUND_PENDING");
        }
        bookingRepository.save(booking);

        DepositRefund saved = depositRefundRepository.save(refund);

        auditLogService.createAuditLog(adminId, AuditAction.DEPOSIT_REFUND_EXECUTED, AuditTargetType.DEPOSIT_REFUND,
                saved.getId(), AuditMetadata.of(
                        "bookingId", saved.getBookingId(),
                        "status", saved.getStatus(),
                        "transactionReference", request.getTransactionReference()));

        if (success) {
            notificationService.notifyDepositRefundCompleted(saved.getCustomerId(), saved.getBookingId(), saved.getRequestedAmount());
        }

        return toResponse(saved);
    }

    private DepositRefundEligibilityResponse evaluateEligibility(Booking booking) {
        BigDecimal amount = booking.getRefundAmount();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0
                || !"REFUND_PENDING".equals(booking.getDepositStatus())) {
            return DepositRefundEligibilityResponse.builder()
                    .eligible(false)
                    .refundAmount(BigDecimal.ZERO)
                    .reasonCode("NOT_ELIGIBLE_STATUS")
                    .message("This booking is not eligible for a deposit refund.")
                    .build();
        }

        boolean hasOpenRequest = depositRefundRepository
                .findFirstByBookingIdAndStatusInOrderByRequestedAtDesc(booking.getId(), OPEN_STATUSES)
                .isPresent();
        if (hasOpenRequest) {
            return DepositRefundEligibilityResponse.builder()
                    .eligible(false)
                    .refundAmount(amount)
                    .reasonCode("ALREADY_REQUESTED")
                    .message("A refund request for this booking is already in progress.")
                    .build();
        }

        return DepositRefundEligibilityResponse.builder()
                .eligible(true)
                .refundAmount(amount)
                .reasonCode("OK")
                .message("Eligible for refund.")
                .build();
    }

    private Booking loadOwnedBooking(Long bookingId, Long customerId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found: " + bookingId));
        if (booking.getCustomerId() == null || !booking.getCustomerId().equals(customerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This booking does not belong to you");
        }
        return booking;
    }

    private Booking loadOwnedBookingForUpdate(Long bookingId, Long customerId) {
        Booking booking = bookingRepository.findByIdWithLock(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found: " + bookingId));
        if (booking.getCustomerId() == null || !booking.getCustomerId().equals(customerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This booking does not belong to you");
        }
        return booking;
    }

    private DepositRefund loadRefund(Long refundId) {
        return depositRefundRepository.findById(refundId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Refund request not found: " + refundId));
    }

    private DepositRefund loadRefundForUpdate(Long refundId) {
        return depositRefundRepository.findByIdWithLock(refundId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Refund request not found: " + refundId));
    }

    private Booking loadRefundBookingForUpdate(DepositRefund refund) {
        return bookingRepository.findByIdWithLock(refund.getBookingId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
    }

    private void validateBookingStillRefundable(Booking booking, DepositRefund refund) {
        if (!"CANCELED".equals(booking.getStatus())
                || !"REFUND_PENDING".equals(booking.getDepositStatus())
                || booking.getRefundAmount() == null
                || booking.getRefundAmount().compareTo(refund.getRequestedAmount()) != 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Booking refund state changed. Refresh and review the request again.");
        }
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!VALID_STATUSES.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid refund status: " + status);
        }
        return normalized;
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private DepositRefundResponse toResponse(DepositRefund r) {
        return DepositRefundResponse.builder()
                .id(r.getId())
                .bookingId(r.getBookingId())
                .customerId(r.getCustomerId())
                .bankAccountId(r.getBankAccountId())
                .bankName(r.getBankName())
                .accountNumber(r.getAccountNumber())
                .accountHolderName(r.getAccountHolderName())
                .requestedAmount(r.getRequestedAmount())
                .status(r.getStatus())
                .rejectReason(r.getRejectReason())
                .adminNote(r.getAdminNote())
                .transactionReference(r.getTransactionReference())
                .requestedAt(r.getRequestedAt())
                .reviewedBy(r.getReviewedBy())
                .reviewedAt(r.getReviewedAt())
                .executedBy(r.getExecutedBy())
                .executedAt(r.getExecutedAt())
                .build();
    }
}
