package com.autowashpro.repository;

import com.autowashpro.entity.AuditLog;
import com.autowashpro.repository.spec.AuditLogSpecifications;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

@DataJpaTest
@ActiveProfiles("test")
class AuditLogRepositoryTest {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Test
    void filtersByActorActionTargetTypeAndDateRange() {
        auditLogRepository.save(log(3L, "BOOKING_MARK_PAID", "BOOKING", 10L, LocalDateTime.of(2026, 7, 7, 8, 0)));
        auditLogRepository.save(log(4L, "BOOKING_CANCELLED", "BOOKING", 11L, LocalDateTime.of(2026, 7, 7, 9, 0)));
        auditLogRepository.save(log(null, "PAYMENT_CONFIRMED", "PAYMENT_TRANSACTION", 12L, LocalDateTime.of(2026, 7, 8, 8, 0)));

        Specification<AuditLog> specification = Specification.allOf(
                AuditLogSpecifications.actorIdEquals(3L),
                AuditLogSpecifications.actionEquals("booking_mark_paid"),
                AuditLogSpecifications.targetTypeEquals("booking"),
                AuditLogSpecifications.createdAtFrom(LocalDateTime.of(2026, 7, 7, 0, 0)),
                AuditLogSpecifications.createdAtBefore(LocalDateTime.of(2026, 7, 8, 0, 0)));
        Page<AuditLog> result = auditLogRepository.findAll(specification, PageRequest.of(0, 10));

        assertEquals(1, result.getTotalElements());
        assertEquals(10L, result.getContent().getFirst().getTargetId());
    }

    @Test
    void storesSystemActionWithoutActor() {
        AuditLog saved = auditLogRepository.saveAndFlush(log(
                null,
                "PAYMENT_CONFIRMED",
                "PAYMENT_TRANSACTION",
                12L,
                LocalDateTime.of(2026, 7, 8, 8, 0)));

        assertNull(saved.getActorId());
    }

    private AuditLog log(Long actorId, String action, String targetType, Long targetId, LocalDateTime createdAt) {
        return AuditLog.builder()
                .actorId(actorId)
                .action(action)
                .targetType(targetType)
                .targetId(targetId)
                .metadata("{}")
                .createdAt(createdAt)
                .build();
    }
}
