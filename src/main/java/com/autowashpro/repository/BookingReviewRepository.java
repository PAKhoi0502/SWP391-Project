package com.autowashpro.repository;

import com.autowashpro.entity.BookingReview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BookingReviewRepository extends JpaRepository<BookingReview, Long> {

    Optional<BookingReview> findByBookingId(Long bookingId);

    boolean existsByBookingId(Long bookingId);

    Page<BookingReview> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
