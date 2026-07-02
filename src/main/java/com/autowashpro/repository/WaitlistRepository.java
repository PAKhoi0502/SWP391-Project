package com.autowashpro.repository;

import com.autowashpro.entity.Waitlist;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface WaitlistRepository extends JpaRepository<Waitlist, Long> {

    Page<Waitlist> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);

    Page<Waitlist> findByGarageIdOrderByCreatedAtDesc(Long garageId, Pageable pageable);

    Page<Waitlist> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Waitlist> findByGarageIdAndStatusOrderByCreatedAtDesc(Long garageId, String status, Pageable pageable);

    Page<Waitlist> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    // Check duplicate active waitlist (WAITING or OFFERED) for same customer + same demand
    List<Waitlist> findByCustomerIdAndGarageIdAndServicePackageIdAndDesiredStartTimeAndStatusIn(
            Long customerId,
            Long garageId,
            Long servicePackageId,
            LocalDateTime desiredStartTime,
            List<String> statuses);

    // Find WAITING entries eligible for cutoff expiry check
    List<Waitlist> findByStatusAndDesiredStartTimeBefore(String status, LocalDateTime cutoffTime);




    List<Waitlist> findByGarageIdAndVehicleTypeAndStatusAndDesiredStartTimeBetweenOrderByCreatedAtAsc(
        Long garageId,
        String vehicleType,
        String status,
        LocalDateTime from,
        LocalDateTime to);


        List<Waitlist> findByStatusAndOfferExpiresAtBefore(String status, LocalDateTime now);
}