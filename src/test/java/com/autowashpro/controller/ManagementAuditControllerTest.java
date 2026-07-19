package com.autowashpro.controller;

import com.autowashpro.common.AuditAction;
import com.autowashpro.common.AuditTargetType;
import com.autowashpro.dto.request.AdjustPointsRequest;
import com.autowashpro.dto.request.CreatePromotionRequest;
import com.autowashpro.dto.response.PromotionResponse;
import com.autowashpro.repository.ExpiryRunLogRepository;
import com.autowashpro.scheduler.LoyaltyPointExpiryScheduler;
import com.autowashpro.service.AuditLogService;
import com.autowashpro.service.LoyaltyPointExpiryService;
import com.autowashpro.service.LoyaltyService;
import com.autowashpro.service.PromotionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ManagementAuditControllerTest {

    @Mock
    private PromotionService promotionService;

    @Mock
    private LoyaltyService loyaltyService;

    @Mock
    private LoyaltyPointExpiryService loyaltyPointExpiryService;

    @Mock
    private LoyaltyPointExpiryScheduler loyaltyPointExpiryScheduler;

    @Mock
    private ExpiryRunLogRepository expiryRunLogRepository;

    @Mock
    private AuditLogService auditLogService;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "3",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void promotionCreateWritesAdminAuditLog() {
        CreatePromotionRequest request = mock(CreatePromotionRequest.class);
        when(promotionService.createPromotion(request)).thenReturn(PromotionResponse.builder()
                .id(30L)
                .code("SUMMER")
                .isActive(true)
                .build());
        PromotionController controller = new PromotionController(promotionService, auditLogService);

        controller.createPromotion(request);

        verify(auditLogService).createAuditLog(
                eq(3L),
                eq(AuditAction.PROMOTION_CREATED),
                eq(AuditTargetType.PROMOTION),
                eq(30L),
                any());
    }

    @Test
    void loyaltyAdjustmentWritesAdminAuditLog() {
        AdjustPointsRequest request = mock(AdjustPointsRequest.class);
        when(request.getCustomerId()).thenReturn(40L);
        when(request.getPoints()).thenReturn(100);
        when(request.getType()).thenReturn("ADMIN_ADJUSTMENT");
        when(request.getReason()).thenReturn("Service recovery");
        LoyaltyController controller = new LoyaltyController(loyaltyService, loyaltyPointExpiryService, auditLogService, loyaltyPointExpiryScheduler, expiryRunLogRepository);

        controller.adjustPoints(request);

        verify(auditLogService).createAuditLog(
                eq(3L),
                eq(AuditAction.LOYALTY_POINTS_ADJUSTED),
                eq(AuditTargetType.CUSTOMER_LOYALTY),
                eq(40L),
                any());
    }
}
