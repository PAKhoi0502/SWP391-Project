package com.autowashpro.repository;

import com.autowashpro.entity.BookingReviewImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BookingReviewImageRepository extends JpaRepository<BookingReviewImage, Long> {

    List<BookingReviewImage> findByReviewIdOrderByDisplayOrderAsc(Long reviewId);
}
