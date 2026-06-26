package com.autowashpro.repository;

import com.autowashpro.entity.VehicleInspection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VehicleInspectionRepository extends JpaRepository<VehicleInspection, Long> {
    List<VehicleInspection> findByBookingIdOrderByCreatedAtAsc(Long bookingId);
}