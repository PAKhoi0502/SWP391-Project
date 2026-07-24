package com.autowashpro.repository;

import com.autowashpro.entity.BookingExceptionReport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BookingExceptionReportRepository extends JpaRepository<BookingExceptionReport, Long> {

    Optional<BookingExceptionReport> findByBookingId(Long bookingId);

    boolean existsByBookingId(Long bookingId);

    List<BookingExceptionReport> findByCustomerId(Long customerId);

    Page<BookingExceptionReport> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<BookingExceptionReport> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    Page<BookingExceptionReport> findByCategoryOrderByCreatedAtDesc(String category, Pageable pageable);

    Page<BookingExceptionReport> findByStatusAndCategoryOrderByCreatedAtDesc(String status, String category, Pageable pageable);
}
