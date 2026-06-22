package com.autowashpro.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "service_package_steps")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServicePackageStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(
            name = "service_package_id",
            nullable = false)
    private ServicePackage servicePackage;

    @ManyToOne
    @JoinColumn(name = "parent_step_id")
    private ServicePackageStep parentStep;

    @Column(name = "step_order")
    private Integer stepOrder;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(name = "is_required")
    private Boolean isRequired;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}