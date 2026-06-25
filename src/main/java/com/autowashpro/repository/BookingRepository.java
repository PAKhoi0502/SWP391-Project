package com.autowashpro.repository;

import com.autowashpro.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    // Giữ nguyên từ phong-bk (issue #10)
    List<Booking> findByGarageId(Long garageId);

    List<Booking> findByGarageIdAndStartTimeBetween(
            Long garageId,
            LocalDateTime start,
            LocalDateTime end);

    // Thêm cho issue #11
    // Kiểm tra xe có booking active nào overlap không
    @Query("""
        SELECT COUNT(b) FROM Booking b
        WHERE b.vehicleId = :vehicleId
        AND b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
        AND b.startTime < :endTime
        AND b.endTime > :startTime
        """)
    long countOverlappingBookingsByVehicle(
            @Param("vehicleId") Long vehicleId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    // Đếm upcoming bookings của customer
    @Query("""
        SELECT COUNT(b) FROM Booking b
        WHERE b.customerId = :customerId
        AND b.status IN ('CONFIRMED', 'CHECKED_IN')
        AND b.startTime > :now
        """)
    long countUpcomingBookings(
            @Param("customerId") Long customerId,
            @Param("now") LocalDateTime now
    );

    // Lấy bookings theo customer
    List<Booking> findByCustomerIdOrderByStartTimeDesc(Long customerId);

    @Query("""
    SELECT COUNT(b) FROM Booking b
    JOIN Vehicle v ON v.id = b.vehicleId
    WHERE b.garageId = :garageId
    AND v.vehicleType = :vehicleType
    AND b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
    AND b.startTime < :endTime
    AND b.endTime > :startTime
    """)
long countOverlappingBookingsByGarageAndVehicleType(
        @Param("garageId") Long garageId,
        @Param("vehicleType") String vehicleType,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime
);
}