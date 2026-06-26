package com.autowashpro.repository;

import com.autowashpro.entity.VehicleInspectionImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VehicleInspectionImageRepository extends JpaRepository<VehicleInspectionImage, Long> {
    List<VehicleInspectionImage> findByVehicleInspectionId(Long vehicleInspectionId);
}