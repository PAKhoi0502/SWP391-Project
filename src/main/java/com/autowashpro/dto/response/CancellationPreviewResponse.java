package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Task 4: Preview of the cancellation refund calculation.
 * Returned by GET /bookings/{bookingId}/cancellation-preview.
 * This endpoint does NOT mutate any data.
 */
@Data
@Builder
public class CancellationPreviewResponse {

    private Long bookingId;

    /**
     * Customer's 1-based sequential booking number; null for guests.
     */
    private Integer customerBookingNumber;

    /** True when the booking's deposit has been paid (depositStatus == PAID). */
    private boolean depositPaid;

    /** The deposit amount on the booking (may be zero). */
    private BigDecimal depositAmount;

    /**
     * Applicable refund percentage as a whole number (100, 80, 50, or 0).
     * Meaningful only when depositPaid is true.
     */
    private int refundPercentage;

    /** Calculated refund amount = depositAmount * refundPercentage / 100. */
    private BigDecimal refundAmount;

    /**
     * True when the customer is eligible to receive a refund:
     * depositPaid == true AND refundAmount > 0.
     */
    private boolean eligibleForRefund;

    /**
     * Short rule code describing which refund tier applies.
     * One of: GRACE_PERIOD, FULL_REFUND, PARTIAL_80, PARTIAL_50, NO_REFUND, NO_DEPOSIT, GARAGE_FAULT.
     */
    private String ruleCode;

    /** Human-readable explanation for the customer. */
    private String message;
}
