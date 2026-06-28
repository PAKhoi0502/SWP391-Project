package com.autowashpro.repository;

import com.autowashpro.entity.BookingServiceStep;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BookingServiceStepRepository
                extends JpaRepository<BookingServiceStep, Long> {

        List<BookingServiceStep> findByBookingIdOrderByStepOrder(Long bookingId);

}