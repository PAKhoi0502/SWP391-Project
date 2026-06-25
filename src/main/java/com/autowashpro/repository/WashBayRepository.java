package com.autowashpro.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.autowashpro.entity.WashBay;

public interface WashBayRepository
        extends JpaRepository<WashBay, Long>, JpaSpecificationExecutor<WashBay> {

    @Query("SELECT DISTINCT w.vehicleType FROM WashBay w WHERE w.garageId = :garageId AND w.isActive = true")
    List<String> findDistinctVehicleTypesByGarageId(@Param("garageId") Long garageId);

    @Query("SELECT COUNT(w) FROM WashBay w WHERE w.garageId = :garageId AND w.vehicleType = :vehicleType AND w.status = com.autowashpro.entity.enums.WashBayStatus.AVAILABLE AND w.isActive = true")
    long countAvailableByGarageAndVehicleType(@Param("garageId") Long garageId,
                                               @Param("vehicleType") String vehicleType);

    @Query("SELECT w.vehicleType, COUNT(w) FROM WashBay w WHERE w.garageId = :garageId AND w.status = com.autowashpro.entity.enums.WashBayStatus.AVAILABLE AND w.isActive = true GROUP BY w.vehicleType")
    List<Object[]> countAvailableGroupedByVehicleType(@Param("garageId") Long garageId);

    boolean existsByGarageIdAndBayCode(Long garageId, String bayCode);
    
    // Đếm booking đang chiếm wash bay theo garage + vehicle type + time
@Query("""
    SELECT COUNT(b) FROM Booking b
    WHERE b.garageId = :garageId
    AND b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
    AND b.startTime < :endTime
    AND b.endTime > :startTime
    """)
long countOverlappingBookingsByGarageAndVehicleType(
        @Param("garageId") Long garageId,
        @Param("vehicleType") String vehicleType,
        @Param("startTime") java.time.LocalDateTime startTime,
        @Param("endTime") java.time.LocalDateTime endTime
);
}