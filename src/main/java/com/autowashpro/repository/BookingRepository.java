package com.autowashpro.repository;

import com.autowashpro.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface BookingRepository
        extends JpaRepository<Booking, Long> {

    List<Booking> findByGarageId(Long garageId);

    List<Booking> findByGarageIdAndStartTimeBetween(
            Long garageId,
            LocalDateTime start,
            LocalDateTime end);

    
}