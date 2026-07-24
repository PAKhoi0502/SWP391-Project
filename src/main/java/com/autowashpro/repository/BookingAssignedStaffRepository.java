package com.autowashpro.repository;

import com.autowashpro.entity.BookingAssignedStaff;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.enums.StaffType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Pageable;

public interface BookingAssignedStaffRepository extends JpaRepository<BookingAssignedStaff, Long> {

    @Query("""
            SELECT a FROM BookingAssignedStaff a
            WHERE a.staffProfileId = :profileId
              AND a.roleInBooking = 'VEHICLE_CARE_STAFF'
              AND a.status IN :validStatuses
              AND (:statusFilter IS NULL OR a.status = :statusFilter)
              AND (:startDate IS NULL OR (a.assignedFrom IS NOT NULL AND a.assignedFrom >= :startDate AND a.assignedFrom < :endDate))
              AND EXISTS (SELECT 1 FROM Booking b WHERE b.id = a.bookingId)
            ORDER BY a.assignedFrom ASC NULLS LAST, a.id ASC
            """)
    List<BookingAssignedStaff> findVisibleCareTaskAssignments(
            @Param("profileId") Long profileId,
            @Param("validStatuses") Collection<String> validStatuses,
            @Param("statusFilter") String statusFilter,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            Pageable pageable);

    // Đếm số staff đang được assign trong khoảng thời gian
    // Includes ASSIGNED (legacy), RESERVED, and ACTIVE statuses to prevent double-booking
    @Query("""
            SELECT COUNT(DISTINCT bas.staffProfileId)
            FROM BookingAssignedStaff bas
            JOIN StaffProfile sp ON sp.id = bas.staffProfileId
            WHERE sp.garageId = :garageId
              AND sp.staffType = :staffType
              AND sp.isActive = true
              AND bas.status IN ('ASSIGNED', 'RESERVED', 'ACTIVE')
              AND bas.assignedFrom < :endTime
              AND bas.assignedTo > :startTime
            """)
    long countAssignedStaffByGarageAndTypeAndTime(
            @Param("garageId") Long garageId,
            @Param("staffType") StaffType staffType,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    @Query("""
            SELECT sp
            FROM StaffProfile sp
            WHERE sp.garageId = :garageId
              AND sp.staffType = :staffType
              AND sp.isActive = true
              AND sp.id NOT IN (
                    SELECT bas.staffProfileId
                    FROM BookingAssignedStaff bas
                    WHERE bas.status IN ('ASSIGNED', 'RESERVED', 'ACTIVE')
                      AND bas.assignedFrom < :endTime
                      AND bas.assignedTo > :startTime
              )
            """)
    List<StaffProfile> findAvailableStaff(
            @Param("garageId") Long garageId,
            @Param("staffType") StaffType staffType,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    @Query("""
            SELECT COUNT(b)
            FROM BookingAssignedStaff b
            WHERE b.staffProfileId = :staffProfileId
              AND b.status IN ('ASSIGNED', 'RESERVED', 'ACTIVE')
              AND b.assignedFrom < :endTime
              AND b.assignedTo > :startTime
            """)
    long countOverlap(
            @Param("staffProfileId") Long staffProfileId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    List<BookingAssignedStaff> findByBookingId(Long bookingId);

    List<BookingAssignedStaff> findByStaffProfileIdAndStatus(Long staffProfileId, String status);

    List<BookingAssignedStaff> findByStaffProfileId(Long staffProfileId);

    /** Count overlapping assignments for a staff member, excluding RELEASED and CANCELED statuses. */
    @Query("""
            SELECT COUNT(b)
            FROM BookingAssignedStaff b
            WHERE b.staffProfileId = :staffProfileId
              AND b.status NOT IN ('RELEASED', 'CANCELED')
              AND b.assignedFrom < :endTime
              AND b.assignedTo > :startTime
            """)
    long countOverlapExcludingReleased(
            @Param("staffProfileId") Long staffProfileId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );
}