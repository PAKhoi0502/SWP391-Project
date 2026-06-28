package com.autowashpro.repository;

import com.autowashpro.entity.BookingAssignedStaff;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.enums.StaffType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface BookingAssignedStaffRepository extends JpaRepository<BookingAssignedStaff, Long> {

    // Đếm số staff đang được assign trong khoảng thời gian
    @Query("""
            SELECT COUNT(DISTINCT bas.staffProfileId)
            FROM BookingAssignedStaff bas
            JOIN StaffProfile sp ON sp.id = bas.staffProfileId
            WHERE sp.garageId = :garageId
              AND sp.staffType = :staffType
              AND sp.isActive = true
              AND bas.status = 'ASSIGNED'
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
                    WHERE bas.status = 'ASSIGNED'
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
              AND b.status = 'ASSIGNED'
              AND b.assignedFrom < :endTime
              AND b.assignedTo > :startTime
            """)
    long countOverlap(
            @Param("staffProfileId") Long staffProfileId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    List<BookingAssignedStaff> findByBookingId(Long bookingId);
}