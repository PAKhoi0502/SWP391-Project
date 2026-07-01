package com.autowashpro.repository;

import com.autowashpro.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    // Giữ nguyên từ phong-bk (issue #10)
    List<Booking> findByGarageId(Long garageId);

    List<Booking> findByGarageIdAndStartTimeBetween(
            Long garageId,
            LocalDateTime start,
            LocalDateTime end);

    // Issue #11: Kiểm tra xe có booking active nào overlap không
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

    // Issue #11: Đếm upcoming bookings của customer
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

    // Issue #11: Lấy bookings theo customer
    List<Booking> findByCustomerIdOrderByStartTimeDesc(Long customerId);

    // ===== Issue #13 =====

    Optional<Booking> findByIdAndCustomerId(
            Long id,
            Long customerId);

    List<Booking> findByGarageIdOrderByStartTimeDesc(
            Long garageId);

    List<Booking> findByGarageIdAndBookingDateOrderByStartTimeDesc(
            Long garageId,
            LocalDate bookingDate);

    List<Booking> findAllByOrderByStartTimeDesc();

    // ====================

    // Issue #11: Đếm booking chiếm wash bay theo garage + vehicle type
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

    // Issue #12: Kiểm tra license plate overlap (walk-in booking)
    @Query("""
        SELECT COUNT(b) FROM Booking b
        WHERE b.licensePlate = :licensePlate
        AND b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
        AND b.startTime < :endTime
        AND b.endTime > :startTime
        """)
    long countOverlappingBookingsByLicensePlate(
            @Param("licensePlate") String licensePlate,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    // Issue #12: Đếm tất cả booking đang chiếm wash bay theo garage (dùng cho walk-in)
    @Query("""
        SELECT COUNT(b) FROM Booking b
        WHERE b.garageId = :garageId
        AND b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
        AND b.startTime < :endTime
        AND b.endTime > :startTime
        """)
    long countOverlappingBookingsByGarage(
            @Param("garageId") Long garageId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    @Query("""
        SELECT COUNT(b) FROM Booking b
        WHERE b.customerId = :customerId
        AND b.garageId = :garageId
        AND b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
        AND b.startTime < :endTime
        AND b.endTime > :startTime
        """)
    long countOverlappingBookingsByCustomerAndGarage(
            @Param("customerId") Long customerId,
            @Param("garageId") Long garageId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );
}