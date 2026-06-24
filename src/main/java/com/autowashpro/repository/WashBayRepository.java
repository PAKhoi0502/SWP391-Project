package com.autowashpro.repository;

import com.autowashpro.entity.WashBay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface WashBayRepository extends JpaRepository<WashBay, Long> {

    @Query("SELECT DISTINCT w.vehicleType FROM WashBay w WHERE w.garageId = :garageId AND w.isActive = true")
    List<String> findDistinctVehicleTypesByGarageId(@Param("garageId") Long garageId);
}