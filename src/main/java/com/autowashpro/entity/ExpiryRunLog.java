package com.autowashpro.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "expiry_run_logs")
@Getter
@Setter
public class ExpiryRunLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** SCHEDULED (daily cron) or MANUAL (admin triggered). */
    @Column(name = "trigger_type", nullable = false, length = 20)
    private String triggerType;

    /** Non-null only for MANUAL runs. */
    @Column(name = "customer_id")
    private Long customerId;

    /** RUNNING | SUCCESS | PARTIAL_FAILURE | FAILURE */
    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    @Column(name = "customers_processed", nullable = false)
    private Integer customersProcessed = 0;

    @Column(name = "customers_succeeded", nullable = false)
    private Integer customersSucceeded = 0;

    @Column(name = "customers_failed", nullable = false)
    private Integer customersFailed = 0;

    @Column(name = "lots_expired", nullable = false)
    private Integer lotsExpired = 0;

    @Column(name = "points_expired", nullable = false)
    private Integer pointsExpired = 0;

    @Column(name = "error_summary", length = 500)
    private String errorSummary;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
