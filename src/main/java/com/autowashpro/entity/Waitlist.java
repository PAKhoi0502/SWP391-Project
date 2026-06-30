package com.autowashpro.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "waitlists")
@Getter
@Setter
public class Waitlist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "garage_id", nullable = false)
    private Long garageId;

    @Column(name = "customer_id")
    private Long customerId;

    @Column(name = "vehicle_id")
    private Long vehicleId;

    @Column(name = "service_package_id", nullable = false)
    private Long servicePackageId;

    @Column(name = "offered_booking_id")
    private Long offeredBookingId;

    @Column(name = "desired_start_time", nullable = false)
    private LocalDateTime desiredStartTime;

    @Column(name = "desired_end_time", nullable = false)
    private LocalDateTime desiredEndTime;

    @Column(name = "vehicle_type", nullable = false, length = 30)
    private String vehicleType;

    @Column(name = "priority_level", nullable = false)
    private Integer priorityLevel = 1;

    @Column(name = "customer_tier", length = 30)
    private String customerTier;

    @Column(name = "status", nullable = false, length = 30)
    private String status;

    @Column(name = "reason", nullable = false, length = 30)
    private String reason;

    @Column(name = "offered_at")
    private LocalDateTime offeredAt;

    @Column(name = "offer_expires_at")
    private LocalDateTime offerExpiresAt;

    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;

    @Column(name = "canceled_at")
    private LocalDateTime canceledAt;

    @Column(name = "expired_at")
    private LocalDateTime expiredAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}