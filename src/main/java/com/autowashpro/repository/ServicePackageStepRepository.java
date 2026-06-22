package com.autowashpro.repository;

import com.autowashpro.entity.ServicePackageStep;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ServicePackageStepRepository
        extends JpaRepository<ServicePackageStep, Long> {

    List<ServicePackageStep>
    findByServicePackage_IdOrderByStepOrder(
            Long packageId);
}