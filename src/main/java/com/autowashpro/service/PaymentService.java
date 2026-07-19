package com.autowashpro.service;

import com.autowashpro.dto.request.CreatePayOSPaymentRequest;
import com.autowashpro.dto.response.CreatePayOSPaymentResponse;
import com.autowashpro.dto.response.PaymentTransactionResponse;

import java.util.List;
import java.util.Map;

public interface PaymentService {
    CreatePayOSPaymentResponse createPayOSPayment(CreatePayOSPaymentRequest request, Long staffUserId);
    CreatePayOSPaymentResponse createPayOSPaymentForCustomer(CreatePayOSPaymentRequest request, Long customerId);
    CreatePayOSPaymentResponse createPayOSPaymentForGuest(Long bookingId);
    void handlePayOSWebhook(Map<String, Object> webhookData);
    PaymentTransactionResponse getTransactionById(Long id);
    List<PaymentTransactionResponse> getTransactionsByBooking(Long bookingId);
    PaymentTransactionResponse cancelTransaction(Long id, Long staffUserId);

    List<PaymentTransactionResponse> getTransactionsByBookingForCustomer(Long bookingId, Long customerId, String purpose);
    PaymentTransactionResponse getTransactionByIdForCustomer(Long id, Long customerId);
    PaymentTransactionResponse cancelTransactionForCustomer(Long id, Long customerId);
}
