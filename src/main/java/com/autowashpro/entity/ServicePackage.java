package com.autowashpro.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "service_packages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServicePackage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(name = "vehicle_type", nullable = false)
    private String vehicleType;

    @Column(name = "service_type", nullable = false)
    private String serviceType;

    @Column(name = "base_price", nullable = false)
    private BigDecimal basePrice;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;

    @Column(name = "wash_bay_duration_minutes", nullable = false)
    private Integer washBayDurationMinutes;

    @Column(name = "points_earned", nullable = false)
    private Integer pointsEarned;

    @Column(name = "requires_wash_bay", nullable = false)
    private Boolean requiresWashBay;

    @Column(name = "requires_care_staff", nullable = false)
    private Boolean requiresCareStaff;

    @Column(name = "care_staff_type")
    private String careStaffType;

    @Column(name = "care_staff_required_count")
    private Integer careStaffRequiredCount;

    @Column(name = "care_staff_duration_minutes")
    private Integer careStaffDurationMinutes;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}