package com.autowashpro.entity;

import com.autowashpro.entity.enums.WashBayStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "wash_bays")
@Getter
@Setter
public class WashBay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "garage_id", nullable = false)
    private Long garageId;

    @Column(name = "bay_code", nullable = false, length = 50)
    private String bayCode;

    @Column(name = "vehicle_type", nullable = false, length = 30)
    private String vehicleType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private WashBayStatus status;

    @Column(name = "current_booking_id")
    private Long currentBookingId;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}