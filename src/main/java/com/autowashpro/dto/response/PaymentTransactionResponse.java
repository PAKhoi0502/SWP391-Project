package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class PaymentTransactionResponse {
    private Long id;
    private Long bookingId;
    private String paymentMethod;
    private BigDecimal amount;
    private String status;
    private Long orderCode;
    private String checkoutUrl;
    private String qrCode;
    private String cancelReason;
    private LocalDateTime paidAt;
    private LocalDateTime expiredAt;
    private LocalDateTime createdAt;
}