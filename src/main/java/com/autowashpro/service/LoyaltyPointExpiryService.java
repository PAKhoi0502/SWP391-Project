package com.autowashpro.service;

import com.autowashpro.dto.response.CreditLotResponse;
import com.autowashpro.dto.response.CustomerExpiryResultResponse;
import org.springframework.data.domain.Page;

import java.time.LocalDateTime;

public interface LoyaltyPointExpiryService {

    /**
     * Expires all overdue credit lots for a single customer.
     * Creates EXPIRE transactions (source=POINT_EXPIRY) and adjusts availablePoints / expiredPoints.
     * Idempotent — lots already at remainingPoints=0 are skipped.
     * Returns the expiry result (callers that don't need it can ignore the return value).
     * If the customer has no loyalty record, returns a zero-result (no-op, no exception).
     */
    CustomerExpiryResultResponse expireForCustomer(Long customerId);

    /**
     * Admin-only wrapper around expireForCustomer.
     * Unlike expireForCustomer, this throws 404 if the customer has no loyalty record.
     */
    CustomerExpiryResultResponse expireForCustomerAdmin(Long customerId);

    /**
     * Consumes {@code points} via FIFO with type=REDEEM, source=BOOKING_REDEEM.
     * Runs lazy expiry before consuming. Creates allocation records.
     */
    void consumePointsFifo(Long customerId, int points, Long bookingId);

    /**
     * Consumes {@code points} via FIFO with explicit transaction type/source/note.
     * Useful for ADMIN_ADJUST deductions where type differs from BOOKING_REDEEM.
     */
    void consumePointsFifoWithType(Long customerId, int points, Long bookingId,
                                   String txType, String source, String note);

    /**
     * Allocation-aware refund for a canceled booking.
     * <ul>
     *   <li>Valid original lot → restores remainingPoints in-place, adds to availablePoints.</li>
     *   <li>Expired original lot → adds points to expiredPoints, does NOT create a new credit lot.</li>
     *   <li>Legacy REDEEM (no allocations) → all points treated as expired.</li>
     * </ul>
     * No-op when no REDEEM transaction exists for the booking. Idempotent.
     */
    void refundByAllocation(Long bookingId);

    /**
     * Returns credit lots for a customer with optional status/type filter.
     * status: ALL | ACTIVE | EXPIRING_SOON | EXPIRED | CONSUMED
     * expiringWithinDays: if set, ACTIVE lots expiring within that many days
     */
    Page<CreditLotResponse> getCreditLots(Long customerId, int page, int limit,
                                           String status, Integer expiringWithinDays, String type);

    /** Extends the expiry date of a single active credit lot. Records an audit note. */
    void extendLotExpiry(Long lotId, LocalDateTime newExpiredAt, String reason);
}
