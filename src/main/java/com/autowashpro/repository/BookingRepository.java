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

        // ── ACTIVE HOLD condition (shared across queries) ──────────────────────────
        // An "active hold" is any booking that occupies a slot/resource:
        //   CONFIRMED, CHECKED_IN, IN_PROGRESS — always active
        //   PENDING_DEPOSIT — active only while paymentExpiredAt > :now
        // CANCELED, COMPLETED, NO_SHOW, and expired PENDING_DEPOSIT are terminal.

        // Issue #11 (updated): Kiểm tra xe có booking active (overlap time) không — tính cả PENDING_DEPOSIT còn hạn
        @Query("""
                        SELECT COUNT(b) FROM Booking b
                        WHERE b.vehicleId = :vehicleId
                        AND (b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
                             OR (b.status = 'PENDING_DEPOSIT' AND b.paymentExpiredAt > :now))
                        AND b.startTime < :endTime
                        AND b.endTime > :startTime
                        """)
        long countOverlappingBookingsByVehicle(
                        @Param("vehicleId") Long vehicleId,
                        @Param("startTime") LocalDateTime startTime,
                        @Param("endTime") LocalDateTime endTime,
                        @Param("now") LocalDateTime now);

        // Issue #11 (updated): Đếm active holds của customer (thay cho countUpcomingBookings — không lọc theo startTime)
        @Query("""
                        SELECT COUNT(b) FROM Booking b
                        WHERE b.customerId = :customerId
                        AND (b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
                             OR (b.status = 'PENDING_DEPOSIT' AND b.paymentExpiredAt > :now))
                        """)
        long countActiveHolds(
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

        // Issue #11 (updated): Đếm booking chiếm wash bay theo garage + vehicle type — tính cả PENDING_DEPOSIT còn hạn
        @Query("""
                        SELECT COUNT(b) FROM Booking b
                        WHERE b.garageId = :garageId
                        AND b.vehicleType = :vehicleType
                        AND (b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
                             OR (b.status = 'PENDING_DEPOSIT' AND b.paymentExpiredAt > :now))
                        AND b.startTime < :endTime
                        AND b.endTime > :startTime
                        """)
        long countOverlappingBookingsByGarageAndVehicleType(
                        @Param("garageId") Long garageId,
                        @Param("vehicleType") String vehicleType,
                        @Param("startTime") LocalDateTime startTime,
                        @Param("endTime") LocalDateTime endTime,
                        @Param("now") LocalDateTime now);

        // Issue #12 (updated): Kiểm tra license plate overlap — tính cả PENDING_DEPOSIT còn hạn
        @Query("""
                        SELECT COUNT(b) FROM Booking b
                        WHERE b.licensePlate = :licensePlate
                        AND b.vehicleType = :vehicleType
                        AND (b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
                             OR (b.status = 'PENDING_DEPOSIT' AND b.paymentExpiredAt > :now))
                        AND b.startTime < :endTime
                        AND b.endTime > :startTime
                        """)
        long countOverlappingBookingsByLicensePlateAndVehicleType(
                        @Param("licensePlate") String licensePlate,
                        @Param("vehicleType") String vehicleType,
                        @Param("startTime") LocalDateTime startTime,
                        @Param("endTime") LocalDateTime endTime,
                        @Param("now") LocalDateTime now);

        // Issue #12 (updated): Đếm tất cả booking đang chiếm wash bay theo garage — tính cả PENDING_DEPOSIT còn hạn
        @Query("""
                        SELECT COUNT(b) FROM Booking b
                        WHERE b.garageId = :garageId
                        AND (b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
                             OR (b.status = 'PENDING_DEPOSIT' AND b.paymentExpiredAt > :now))
                        AND b.startTime < :endTime
                        AND b.endTime > :startTime
                        """)
        long countOverlappingBookingsByGarage(
                        @Param("garageId") Long garageId,
                        @Param("startTime") LocalDateTime startTime,
                        @Param("endTime") LocalDateTime endTime,
                        @Param("now") LocalDateTime now);

        // (updated): tính cả PENDING_DEPOSIT còn hạn
        @Query("""
                        SELECT COUNT(b) FROM Booking b
                        WHERE b.customerId = :customerId
                        AND b.garageId = :garageId
                        AND (b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
                             OR (b.status = 'PENDING_DEPOSIT' AND b.paymentExpiredAt > :now))
                        AND b.startTime < :endTime
                        AND b.endTime > :startTime
                        """)
        long countOverlappingBookingsByCustomerAndGarage(
                        @Param("customerId") Long customerId,
                        @Param("garageId") Long garageId,
                        @Param("startTime") LocalDateTime startTime,
                        @Param("endTime") LocalDateTime endTime,
                        @Param("now") LocalDateTime now);

        // ── Section E: Chặn cùng xe có nhiều active booking (không phụ thuộc time overlap) ──

        // Kiểm tra xe đã có active booking chưa (registered customer — by vehicleId)
        @Query("""
                        SELECT COUNT(b) FROM Booking b
                        WHERE b.vehicleId = :vehicleId
                        AND (b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
                             OR (b.status = 'PENDING_DEPOSIT' AND b.paymentExpiredAt > :now))
                        """)
        long countActiveBookingsByVehicleId(
                        @Param("vehicleId") Long vehicleId,
                        @Param("now") LocalDateTime now);

        // Kiểm tra biển số đã có active booking chưa (guest — by licensePlate + vehicleType)
        @Query("""
                        SELECT COUNT(b) FROM Booking b
                        WHERE b.licensePlate = :licensePlate
                        AND b.vehicleType = :vehicleType
                        AND (b.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
                             OR (b.status = 'PENDING_DEPOSIT' AND b.paymentExpiredAt > :now))
                        """)
        long countActiveBookingsByLicensePlate(
                        @Param("licensePlate") String licensePlate,
                        @Param("vehicleType") String vehicleType,
                        @Param("now") LocalDateTime now);

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

        List<Booking> findByGarageIdAndStatusInOrderByStartTimeAsc(Long garageId, List<String> statuses);

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
