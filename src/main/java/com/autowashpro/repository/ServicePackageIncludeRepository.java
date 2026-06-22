package com.autowashpro.repository;

import com.autowashpro.entity.ServicePackageInclude;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ServicePackageIncludeRepository
        extends JpaRepository<ServicePackageInclude, Long> {

    List<ServicePackageInclude>
    findByParentServicePackage_Id(Long packageId);
}