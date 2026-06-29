package com.autowashpro.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "customer_loyalties")
@Getter
@Setter
public class CustomerLoyalty {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_id", nullable = false, unique = true)
    private Long customerId;

    @Column(name = "current_tier", nullable = false, length = 30)
    private String currentTier;

    @Column(name = "total_points", nullable = false)
    private Integer totalPoints = 0;

    @Column(name = "available_points", nullable = false)
    private Integer availablePoints = 0;

    @Column(name = "redeemed_points", nullable = false)
    private Integer redeemedPoints = 0;

    @Column(name = "expired_points", nullable = false)
    private Integer expiredPoints = 0;

    @Column(name = "total_spent", nullable = false)
    private BigDecimal totalSpent = BigDecimal.ZERO;

    @Column(name = "total_visits", nullable = false)
    private Integer totalVisits = 0;

    @Column(name = "current_cycle_spent", nullable = false)
    private BigDecimal currentCycleSpent = BigDecimal.ZERO;

    @Column(name = "current_cycle_visits", nullable = false)
    private Integer currentCycleVisits = 0;

    @Column(name = "tier_valid_until")
    private LocalDateTime tierValidUntil;

    @Column(name = "last_tier_review_at")
    private LocalDateTime lastTierReviewAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "last_visit_at")
    private LocalDateTime lastVisitAt;

    @Column(name = "last_point_expiry_check_at")
    private LocalDateTime lastPointExpiryCheckAt;

    @Column(name = "last_tier_downgrade_at")
    private LocalDateTime lastTierDowngradeAt;

    @Column(name = "tier_recovery_started_at")
    private LocalDateTime tierRecoveryStartedAt;
}