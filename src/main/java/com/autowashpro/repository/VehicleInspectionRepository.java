package com.autowashpro.repository;

import com.autowashpro.entity.VehicleInspection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

public interface VehicleInspectionRepository extends JpaRepository<VehicleInspection, Long> {
    List<VehicleInspection> findByBookingIdOrderByCreatedAtAsc(Long bookingId);

    /** Force updatedAt refresh even when no other field changes — required for stale-inspection detection. */
    @Transactional
    @Modifying
    @Query("UPDATE VehicleInspection v SET v.updatedAt = :ts WHERE v.id = :id")
    void touchUpdatedAt(@Param("id") Long id, @Param("ts") LocalDateTime ts);
}