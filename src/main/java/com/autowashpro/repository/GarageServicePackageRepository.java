package com.autowashpro.repository;

import com.autowashpro.entity.GarageServicePackage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface GarageServicePackageRepository
        extends JpaRepository<GarageServicePackage, GarageServicePackage.GarageServicePackageId> {

    List<GarageServicePackage> findByServicePackageIdAndIsActiveTrue(Long servicePackageId);

    List<GarageServicePackage> findByGarageIdAndIsActiveTrue(Long garageId);

    boolean existsByGarageIdAndServicePackageIdAndIsActiveTrue(Long garageId, Long servicePackageId);

    @Query("SELECT gsp.servicePackageId FROM GarageServicePackage gsp " +
           "WHERE gsp.garageId = :garageId AND gsp.isActive = true")
    List<Long> findActivePackageIdsByGarageId(@Param("garageId") Long garageId);

    @Modifying
    @Query("DELETE FROM GarageServicePackage gsp WHERE gsp.servicePackageId = :packageId")
    void deleteAllByServicePackageId(@Param("packageId") Long packageId);
}
