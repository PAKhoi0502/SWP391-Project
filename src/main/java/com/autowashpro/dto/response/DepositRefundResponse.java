package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class DepositRefundResponse {
    private Long id;
    private Long bookingId;
    private Long customerId;
    private Long bankAccountId;
    private String bankName;
    private String accountNumber;
    private String accountHolderName;
    private BigDecimal requestedAmount;
    private String status;
    private String rejectReason;
    private String adminNote;
    private String transactionReference;
    private LocalDateTime requestedAt;
    private Long reviewedBy;
    private LocalDateTime reviewedAt;
    private Long executedBy;
    private LocalDateTime executedAt;
}
