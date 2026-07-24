package com.autowashpro.repository;

import com.autowashpro.entity.ExpiryRunLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ExpiryRunLogRepository extends JpaRepository<ExpiryRunLog, Long> {

    /** Latest completed SCHEDULED run (for GET /expiry-runs/latest). */
    Optional<ExpiryRunLog> findTopByTriggerTypeOrderByStartedAtDesc(String triggerType);

    /** Paginated history, newest first. */
    Page<ExpiryRunLog> findAllByOrderByStartedAtDesc(Pageable pageable);

    /** Paginated history for a specific trigger type. */
    Page<ExpiryRunLog> findByTriggerTypeOrderByStartedAtDesc(String triggerType, Pageable pageable);
}
