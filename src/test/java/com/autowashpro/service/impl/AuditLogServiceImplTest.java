package com.autowashpro.service.impl;

import com.autowashpro.dto.response.AuditLogResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.entity.AuditLog;
import com.autowashpro.repository.AuditLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditLogServiceImplTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private AuditLogWriter auditLogWriter;

    private AuditLogServiceImpl auditLogService;

    @BeforeEach
    void setUp() {
        auditLogService = new AuditLogServiceImpl(auditLogRepository, auditLogWriter, new ObjectMapper());
    }

    @Test
    void createAuditLogRedactsSensitiveMetadataRecursively() {
        auditLogService.createAuditLog(
                5L,
                "booking_mark_paid",
                "booking",
                9L,
                Map.of(
                        "paymentMethod", "CASH",
                        "passwordHash", "hash-value",
                        "nested", Map.of("refresh_token", "refresh-value", "apiKey", "api-value")));

        ArgumentCaptor<String> metadataCaptor = ArgumentCaptor.forClass(String.class);
        verify(auditLogWriter).write(eq(5L), eq("BOOKING_MARK_PAID"), eq("BOOKING"), eq(9L), metadataCaptor.capture());
        String metadata = metadataCaptor.getValue();
        assertTrue(metadata.contains("CASH"));
        assertTrue(metadata.contains("[REDACTED]"));
        assertFalse(metadata.contains("hash-value"));
        assertFalse(metadata.contains("refresh-value"));
        assertFalse(metadata.contains("api-value"));
    }

    @Test
    void createAuditLogDoesNotPropagateWriterFailure() {
        doThrow(new RuntimeException("audit unavailable"))
                .when(auditLogWriter)
                .write(any(), any(), any(), any(), any());

        assertDoesNotThrow(() -> auditLogService.createAuditLog(
                null,
                "PAYMENT_CONFIRMED",
                "PAYMENT_TRANSACTION",
                3L,
                Map.of("status", "PAID")));
    }

    @Test
    void createAuditLogDefersWriteUntilTransactionCommits() {
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            auditLogService.createAuditLog(
                    5L,
                    "BOOKING_CREATED",
                    "BOOKING",
                    9L,
                    Map.of("status", "CONFIRMED"));

            verify(auditLogWriter, never()).write(any(), any(), any(), any(), any());
            List<TransactionSynchronization> synchronizations = TransactionSynchronizationManager.getSynchronizations();
            assertEquals(1, synchronizations.size());
            synchronizations.getFirst().afterCommit();
            verify(auditLogWriter).write(eq(5L), eq("BOOKING_CREATED"), eq("BOOKING"), eq(9L), any());
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
            TransactionSynchronizationManager.setActualTransactionActive(false);
        }
    }

    @Test
    void listReturnsOneBasedPageResponseAndParsedMetadata() {
        AuditLog auditLog = AuditLog.builder()
                .id(11L)
                .actorId(5L)
                .action("BOOKING_MARK_PAID")
                .targetType("BOOKING")
                .targetId(9L)
                .metadata("{\"paymentMethod\":\"CASH\"}")
                .createdAt(LocalDateTime.of(2026, 7, 7, 1, 0))
                .build();
        when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(auditLog)));

        PageResponse<AuditLogResponse> response = auditLogService.list(
                1,
                10,
                5L,
                "booking_mark_paid",
                "booking",
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 7, 7));

        assertEquals(1, response.getPage());
        assertEquals(1, response.getData().size());
        assertEquals("CASH", response.getData().getFirst().getMetadata().get("paymentMethod"));
    }

    @Test
    void listRejectsInvalidDateRange() {
        assertThrows(ResponseStatusException.class, () -> auditLogService.list(
                1,
                10,
                null,
                null,
                null,
                LocalDate.of(2026, 7, 8),
                LocalDate.of(2026, 7, 7)));
    }

    @Test
    void getByIdReturnsNotFoundWhenMissing() {
        when(auditLogRepository.findById(99L)).thenReturn(java.util.Optional.empty());
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> auditLogService.getById(99L));
        assertEquals(404, exception.getStatusCode().value());
    }
}
