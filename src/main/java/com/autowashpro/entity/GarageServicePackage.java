package com.autowashpro.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDateTime;

@Entity
@Table(name = "garage_service_packages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@IdClass(GarageServicePackage.GarageServicePackageId.class)
public class GarageServicePackage {

    @Id
    @Column(name = "garage_id", nullable = false)
    private Long garageId;

    @Id
    @Column(name = "service_package_id", nullable = false)
    private Long servicePackageId;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @EqualsAndHashCode
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GarageServicePackageId implements Serializable {
        private Long garageId;
        private Long servicePackageId;
    }
}
