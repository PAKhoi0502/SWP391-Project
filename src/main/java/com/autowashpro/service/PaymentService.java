package com.autowashpro.service;

import com.autowashpro.dto.request.CreatePayOSPaymentRequest;
import com.autowashpro.dto.response.CreatePayOSPaymentResponse;
import com.autowashpro.dto.response.PaymentTransactionResponse;

import java.util.List;
import java.util.Map;

public interface PaymentService {
    /** Staff / Admin path — enforces CSS or Admin + garage scope. */
    CreatePayOSPaymentResponse createPayOSPaymentForStaff(CreatePayOSPaymentRequest request, Long staffUserId, String role);
    CreatePayOSPaymentResponse createPayOSPaymentForCustomer(CreatePayOSPaymentRequest request, Long customerId);
    CreatePayOSPaymentResponse createPayOSPaymentForGuest(Long bookingId);
    void handlePayOSWebhook(Map<String, Object> webhookData);
    PaymentTransactionResponse getTransactionById(Long id, Long callerId, String role);
    List<PaymentTransactionResponse> getTransactionsByBooking(Long bookingId, Long callerId, String role);
    PaymentTransactionResponse cancelTransaction(Long id, Long staffUserId, String role);

    List<PaymentTransactionResponse> getTransactionsByBookingForCustomer(Long bookingId, Long customerId, String purpose);
    PaymentTransactionResponse getTransactionByIdForCustomer(Long id, Long customerId);
    PaymentTransactionResponse cancelTransactionForCustomer(Long id, Long customerId);
}
