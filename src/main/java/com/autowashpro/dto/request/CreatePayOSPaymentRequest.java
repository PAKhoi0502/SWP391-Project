package com.autowashpro.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreatePayOSPaymentRequest {
    @NotNull
    private Long bookingId;

    /**
     * Payment purpose: "DEPOSIT" (default) or "FINAL".
     * DEPOSIT — creates a link for the 30 % pre-payment on a PENDING_DEPOSIT booking.
     * FINAL   — creates a link for the remaining balance on a COMPLETED booking.
     */
    private String purpose = "DEPOSIT";
}