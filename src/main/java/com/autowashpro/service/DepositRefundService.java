package com.autowashpro.service;

import com.autowashpro.dto.request.CreateDepositRefundRequest;
import com.autowashpro.dto.request.ExecuteDepositRefundRequest;
import com.autowashpro.dto.request.RejectDepositRefundRequest;
import com.autowashpro.dto.response.DepositRefundEligibilityResponse;
import com.autowashpro.dto.response.DepositRefundResponse;
import com.autowashpro.dto.response.PageResponse;

import java.util.List;

public interface DepositRefundService {

    DepositRefundEligibilityResponse getEligibility(Long bookingId, Long customerId);

    DepositRefundResponse createRequest(Long bookingId, Long customerId, CreateDepositRefundRequest request);

    List<DepositRefundResponse> listOwn(Long customerId);

    DepositRefundResponse getOwnById(Long refundId, Long customerId);

    PageResponse<DepositRefundResponse> listForAdmin(int page, int limit, String status);

    DepositRefundResponse getByIdForAdmin(Long refundId);

    DepositRefundResponse approve(Long refundId, Long adminId);

    DepositRefundResponse reject(Long refundId, Long adminId, RejectDepositRefundRequest request);

    DepositRefundResponse execute(Long refundId, Long adminId, ExecuteDepositRefundRequest request);
}
