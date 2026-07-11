package com.autowashpro.repository;

import com.autowashpro.entity.VehicleInspectionImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VehicleInspectionImageRepository extends JpaRepository<VehicleInspectionImage, Long> {
    List<VehicleInspectionImage> findByVehicleInspectionId(Long vehicleInspectionId);

    Optional<VehicleInspectionImage> findByPublicId(String publicId);
}
