package com.autowashpro.repository;

import com.autowashpro.entity.WashBay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface WashBayRepository
        extends JpaRepository<WashBay, Long>, JpaSpecificationExecutor<WashBay> {

    // Dùng cho GarageCapabilities (issue #6)
    @Query("SELECT DISTINCT w.vehicleType FROM WashBay w WHERE w.garageId = :garageId AND w.isActive = true")
    List<String> findDistinctVehicleTypesByGarageId(@Param("garageId") Long garageId);

    // Dùng cho capacity endpoint
    @Query("SELECT COUNT(w) FROM WashBay w WHERE w.garageId = :garageId AND w.vehicleType = :vehicleType AND w.status = 'AVAILABLE' AND w.isActive = true")
    long countAvailableByGarageAndVehicleType(@Param("garageId") Long garageId,
                                               @Param("vehicleType") String vehicleType);

    // Dùng cho capacity endpoint (không filter vehicle type)
    @Query("SELECT w.vehicleType, COUNT(w) FROM WashBay w WHERE w.garageId = :garageId AND w.status = 'AVAILABLE' AND w.isActive = true GROUP BY w.vehicleType")
    List<Object[]> countAvailableGroupedByVehicleType(@Param("garageId") Long garageId);

    boolean existsByGarageIdAndBayCode(Long garageId, String bayCode);
}