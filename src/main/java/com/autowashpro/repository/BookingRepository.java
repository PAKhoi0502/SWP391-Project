package com.autowashpro.repository;

import com.autowashpro.entity.Booking;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long> {

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("SELECT b FROM Booking b WHERE b.id = :id")
        Optional<Booking> findByIdWithLock(@Param("id") Long id);

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
                        @Param("endTime") LocalDateTime endTime);

        // Issue #11: Đếm upcoming bookings của customer
        @Query("""
                        SELECT COUNT(b) FROM Booking b
                        WHERE b.customerId = :customerId
                        AND b.status IN ('CONFIRMED', 'CHECKED_IN')
                        AND b.startTime > :now
                        """)
        long countUpcomingBookings(
                        @Param("customerId") Long customerId,
                        @Param("now") LocalDateTime now);

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

        long countByPromotionIdAndCustomerIdAndStatusNot(Long promotionId, Long customerId, String status);

        long countByPromotionIdAndStatusNot(Long promotionId, String status);

        // ====================

        // Issue #11: Đếm booking chiếm wash bay theo garage + vehicle type.
        // Dùng b.vehicleType (lưu trực tiếp trên booking) thay vì JOIN sang Vehicle,
        // vì khách vãng lai (walk-in) không có vehicle_id nên sẽ bị JOIN loại bỏ nhầm.
        @Query("""
                        SELECT COUNT(b) FROM Booking b
                        WHERE b.garageId = :garageId
                        AND b.vehicleType = :vehicleType
                        AND b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
                        AND b.startTime < :endTime
                        AND b.endTime > :startTime
                        """)
        long countOverlappingBookingsByGarageAndVehicleType(
                        @Param("garageId") Long garageId,
                        @Param("vehicleType") String vehicleType,
                        @Param("startTime") LocalDateTime startTime,
                        @Param("endTime") LocalDateTime endTime);

        // Issue #12: Kiểm tra license plate overlap (walk-in booking)
        @Query("""
                        SELECT COUNT(b) FROM Booking b
                        WHERE b.licensePlate = :licensePlate
                        AND b.vehicleType = :vehicleType
                        AND b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
                        AND b.startTime < :endTime
                        AND b.endTime > :startTime
                        """)
        long countOverlappingBookingsByLicensePlateAndVehicleType(
                        @Param("licensePlate") String licensePlate,
                        @Param("vehicleType") String vehicleType,
                        @Param("startTime") LocalDateTime startTime,
                        @Param("endTime") LocalDateTime endTime);

        // Issue #12: Đếm tất cả booking đang chiếm wash bay theo garage (dùng cho
        // walk-in)
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
                        @Param("endTime") LocalDateTime endTime);

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
                        @Param("endTime") LocalDateTime endTime);

        List<Booking> findByStatusAndDepositStatus(
                        String status,
                        String depositStatus);

        @Query("""
                        SELECT b
                        FROM Booking b
                        WHERE b.status = 'PENDING_DEPOSIT'
                        AND b.depositStatus NOT IN ('PAID', 'REFUND_PENDING', 'REFUNDED')
                        AND b.paymentExpiredAt IS NOT NULL
                        AND b.paymentExpiredAt <= :now
                        """)
        List<Booking> findExpiredPendingDeposits(@Param("now") LocalDateTime now);

        List<Booking> findByDepositStatusOrderByCreatedAtDesc(
                        String depositStatus);

        @Query("""
                        SELECT b
                        FROM Booking b
                        WHERE b.depositStatus = 'REFUND_PENDING'
                        ORDER BY b.updatedAt DESC
                        """)
        List<Booking> findRefundPendingBookings();
        Optional<Booking> findByTrackingToken(String trackingToken);

        /**
         * Task 3: Count bookings for a customer with id <= bookingId (inclusive).
         * This gives the 1-based sequential position of bookingId in this customer's history.
         */
        @Query("SELECT COUNT(b) FROM Booking b WHERE b.customerId = :customerId AND b.id <= :bookingId")
        long countByCustomerIdAndIdLessThanEqual(
                @Param("customerId") Long customerId,
                @Param("bookingId") Long bookingId);

        // ===================== Staff Booking Summary =====================

        @Query("SELECT COUNT(b) FROM Booking b WHERE b.garageId = :garageId AND b.status <> 'PENDING_DEPOSIT'")
        long countByGarageIdExcludingPendingDeposit(@Param("garageId") Long garageId);

        @Query("SELECT COUNT(b) FROM Booking b WHERE b.garageId = :garageId AND b.status = :status")
        long countByGarageIdAndStatus(@Param("garageId") Long garageId, @Param("status") String status);

        @Query("SELECT COUNT(b) FROM Booking b WHERE b.garageId = :garageId AND b.status IN :statuses")
        long countByGarageIdAndStatusIn(@Param("garageId") Long garageId, @Param("statuses") List<String> statuses);

        // ===================== Staff Calendar =====================

        @Query("""
                        SELECT b.startTime, b.status
                        FROM Booking b
                        WHERE b.garageId = :garageId
                        AND b.startTime >= :start
                        AND b.startTime < :end
                        AND b.status IN ('CONFIRMED', 'CANCELED', 'CANCELLED')
                        """)
        List<Object[]> findDateAndStatusForCalendar(
                        @Param("garageId") Long garageId,
                        @Param("start") LocalDateTime start,
                        @Param("end") LocalDateTime end);

}
