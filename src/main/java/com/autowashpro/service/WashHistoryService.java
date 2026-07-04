package com.autowashpro.service;

import com.autowashpro.dto.response.WashHistoryResponse;
import org.springframework.data.domain.Page;

public interface WashHistoryService {

    void createWashHistoryAfterPaidBooking(Long bookingId);

    Page<WashHistoryResponse> getMyWashHistories(Long customerId, int page, int limit);

    WashHistoryResponse getMyWashHistoryDetail(Long id, Long customerId);

    Page<WashHistoryResponse> getAdminWashHistories(Long garageId, Long customerId, String customerName, int page, int limit);
}