package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CreatePayOSPaymentResponse {
    private Long transactionId;
    private Long orderCode;
    private String checkoutUrl;
    private String qrCode;
    private String status;
}