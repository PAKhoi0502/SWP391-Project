package com.autowashpro.service;

import com.autowashpro.dto.request.CreateWaitlistRequest;
import com.autowashpro.dto.response.WaitlistResponse;
import org.springframework.data.domain.Page;

public interface WaitlistService {

    WaitlistResponse createWaitlist(CreateWaitlistRequest request, Long customerId);

    Page<WaitlistResponse> getMyWaitlists(Long customerId, int page, int limit);

    WaitlistResponse getMyWaitlistDetail(Long id, Long customerId);

    WaitlistResponse cancelWaitlist(Long id, Long customerId);

    Page<WaitlistResponse> getAdminWaitlists(Long garageId, String status, Long staffUserId, String role, int page, int limit);

    WaitlistResponse offerWaitlist(Long id, Long staffUserId, String role);

    WaitlistResponse acceptWaitlistOffer(Long id, Long customerId);

    WaitlistResponse expireWaitlist(Long id, Long staffUserId, String role);
}