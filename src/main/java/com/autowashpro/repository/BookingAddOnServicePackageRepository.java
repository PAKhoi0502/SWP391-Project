package com.autowashpro.repository;

import com.autowashpro.entity.BookingAddOnServicePackage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BookingAddOnServicePackageRepository extends JpaRepository<BookingAddOnServicePackage, Long> {
    List<BookingAddOnServicePackage> findByBookingIdOrderBySortOrderAsc(Long bookingId);
}
