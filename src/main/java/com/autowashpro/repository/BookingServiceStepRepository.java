package com.autowashpro.repository;

import com.autowashpro.entity.BookingServiceStep;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingServiceStepRepository
        extends JpaRepository<BookingServiceStep,Long> {
}