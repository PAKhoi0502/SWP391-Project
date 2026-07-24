package com.autowashpro.repository;

import com.autowashpro.entity.PointTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PointTransactionRepository extends JpaRepository<PointTransaction, Long> {
    Page<PointTransaction> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);
    Optional<PointTransaction> findByBookingIdAndType(Long bookingId, String type);
    List<PointTransaction> findByCustomerIdAndTypeOrderByExpiredAtAsc(Long customerId, String type);
    Page<PointTransaction> findByCustomerIdAndTypeOrderByCreatedAtDesc(Long customerId, String type, Pageable pageable);

    /** Active credit lots available for FIFO consumption, soonest-expiring first. */
    @Query("""
        SELECT pt FROM PointTransaction pt
        WHERE pt.customerId = :customerId
          AND pt.points > 0
          AND pt.remainingPoints > 0
          AND (pt.expiredAt IS NULL OR pt.expiredAt > :now)
        ORDER BY pt.expiredAt ASC, pt.createdAt ASC, pt.id ASC
        """)
    List<PointTransaction> findActiveCreditLotsForFifo(
            @Param("customerId") Long customerId,
            @Param("now") LocalDateTime now);

    /** Credit lots that have passed their expiry date but still have remaining balance. */
    @Query("""
        SELECT pt FROM PointTransaction pt
        WHERE pt.customerId = :customerId
          AND pt.points > 0
          AND pt.remainingPoints > 0
          AND pt.expiredAt IS NOT NULL
          AND pt.expiredAt <= :now
        ORDER BY pt.expiredAt ASC
        """)
    List<PointTransaction> findExpiredCreditLots(
            @Param("customerId") Long customerId,
            @Param("now") LocalDateTime now);

    /** All credit lots for admin view (active and expired), newest first. */
    @Query("""
        SELECT pt FROM PointTransaction pt
        WHERE pt.customerId = :customerId
          AND pt.points > 0
        ORDER BY pt.createdAt DESC
        """)
    List<PointTransaction> findAllCreditLotsByCustomer(@Param("customerId") Long customerId);

    /** Customer IDs that have any expired credit lots with remaining balance (for scheduler). */
    @Query("""
        SELECT DISTINCT pt.customerId FROM PointTransaction pt
        WHERE pt.points > 0
          AND pt.remainingPoints > 0
          AND pt.expiredAt IS NOT NULL
          AND pt.expiredAt <= :now
        """)
    List<Long> findCustomerIdsWithExpiredLots(@Param("now") LocalDateTime now);

    /** Customer IDs with expired lots in the given ID range (for batch paging). */
    @Query("""
        SELECT DISTINCT pt.customerId FROM PointTransaction pt
        WHERE pt.points > 0
          AND pt.remainingPoints > 0
          AND pt.expiredAt IS NOT NULL
          AND pt.expiredAt <= :now
          AND pt.customerId > :afterId
        ORDER BY pt.customerId ASC
        """)
    List<Long> findCustomerIdsWithExpiredLotsAfter(
            @Param("now") LocalDateTime now,
            @Param("afterId") Long afterId,
            Pageable pageable);

    /** Admin: paginated view of all credit lots for a customer with optional type filter. */
    @Query("""
        SELECT pt FROM PointTransaction pt
        WHERE pt.customerId = :customerId
          AND pt.points > 0
          AND (:type IS NULL OR pt.type = :type)
        ORDER BY pt.createdAt DESC
        """)
    Page<PointTransaction> findCreditLotsPaged(
            @Param("customerId") Long customerId,
            @Param("type") String type,
            Pageable pageable);

    /** Admin: paginated transactions for a customer with optional type filter. */
    @Query("""
        SELECT pt FROM PointTransaction pt
        WHERE pt.customerId = :customerId
          AND (:type IS NULL OR pt.type = :type)
        ORDER BY pt.createdAt DESC
        """)
    Page<PointTransaction> findTransactionsPaged(
            @Param("customerId") Long customerId,
            @Param("type") String type,
            Pageable pageable);

    @Query("""
        SELECT pt.customerId, SUM(pt.points), COUNT(pt)
        FROM PointTransaction pt
        JOIN User u ON u.id = pt.customerId
        WHERE pt.type = 'EARN'
          AND pt.source = 'BOOKING_EARN'
          AND pt.points > 0
          AND pt.createdAt >= :rangeStart
          AND pt.createdAt < :rangeEnd
          AND u.role = 'CUSTOMER'
          AND u.isActive = true
        GROUP BY pt.customerId
        ORDER BY SUM(pt.points) DESC, pt.customerId ASC
        """)
    List<Object[]> findLeaderboardAggregateMonthly(
        @Param("rangeStart") LocalDateTime rangeStart,
        @Param("rangeEnd") LocalDateTime rangeEnd);

    @Query("""
        SELECT pt.customerId, SUM(pt.points), COUNT(pt)
        FROM PointTransaction pt
        JOIN User u ON u.id = pt.customerId
        WHERE pt.type = 'EARN'
          AND pt.source = 'BOOKING_EARN'
          AND pt.points > 0
          AND u.role = 'CUSTOMER'
          AND u.isActive = true
        GROUP BY pt.customerId
        ORDER BY SUM(pt.points) DESC, pt.customerId ASC
        """)
    List<Object[]> findLeaderboardAggregateAllTime();
}