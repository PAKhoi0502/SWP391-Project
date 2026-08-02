package com.autowashpro.repository;

import com.autowashpro.entity.SpecialDay;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SpecialDayRepository extends JpaRepository<SpecialDay, Long> {

    List<SpecialDay> findAllByOrderByStartDateDesc();

    // If overlapping special days ever match the same date, the higher surcharge wins.
    Optional<SpecialDay> findFirstByIsActiveTrueAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderBySurchargeRateDesc(
            LocalDate startDate, LocalDate endDate);
}
