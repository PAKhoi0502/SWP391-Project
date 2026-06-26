package com.autowashpro.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "vehicle_inspections")
@Getter
@Setter
public class VehicleInspection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_id", nullable = false)
    private Long bookingId;

    @Column(name = "vehicle_id", nullable = false)
    private Long vehicleId;

    @Column(name = "garage_id", nullable = false)
    private Long garageId;

    @Column(name = "inspected_by_staff_id", nullable = false)
    private Long inspectedByStaffId;

    @Column(name = "type", nullable = false, length = 30)
    private String type; // BEFORE_WASH hoặc AFTER_WASH

    @Column(name = "exterior_condition", columnDefinition = "NVARCHAR(MAX)")
    private String exteriorCondition;

    @Column(name = "interior_condition", columnDefinition = "NVARCHAR(MAX)")
    private String interiorCondition;

    @Column(name = "notes", columnDefinition = "NVARCHAR(MAX)")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}