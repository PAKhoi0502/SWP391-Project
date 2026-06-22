package com.autowashpro.repository;

import com.autowashpro.entity.ServicePackage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ServicePackageRepository
        extends JpaRepository<ServicePackage, Long> {

    List<ServicePackage> findByIsActiveTrue();

    List<ServicePackage> findByVehicleTypeAndIsActiveTrue(
            String vehicleType);

    List<ServicePackage> findByServiceTypeAndIsActiveTrue(
            String serviceType);

    boolean existsByCode(String code);
}