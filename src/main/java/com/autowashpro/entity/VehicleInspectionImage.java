package com.autowashpro.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "vehicle_inspection_images")
@Getter
@Setter
public class VehicleInspectionImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "vehicle_inspection_id", nullable = false)
    private Long vehicleInspectionId;

    @Column(name = "image_url", nullable = false, length = 255)
    private String imageUrl;

    @Column(name = "public_id", length = 255)
    private String publicId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}