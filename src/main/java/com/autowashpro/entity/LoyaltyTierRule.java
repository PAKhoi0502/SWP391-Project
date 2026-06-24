package com.autowashpro.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "loyalty_tier_rules")
@Getter
@Setter
public class LoyaltyTierRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tier", nullable = false, unique = true, length = 30)
    private String tier;

    @Column(name = "min_total_spent", nullable = false)
    private BigDecimal minTotalSpent;

    @Column(name = "min_total_visits", nullable = false)
    private Integer minTotalVisits;

    @Column(name = "booking_window_days", nullable = false)
    private Integer bookingWindowDays;

    @Column(name = "max_upcoming_bookings", nullable = false)
    private Integer maxUpcomingBookings;

    @Column(name = "earn_rate", nullable = false)
    private BigDecimal earnRate;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
}