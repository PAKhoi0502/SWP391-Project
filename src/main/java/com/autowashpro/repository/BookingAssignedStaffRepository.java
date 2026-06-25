package com.autowashpro.repository;

import com.autowashpro.entity.BookingAssignedStaff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookingAssignedStaffRepository extends JpaRepository<BookingAssignedStaff, Long> {

    // Đếm số staff đang được assign trong khoảng thời gian (dùng để validate care staff capacity)
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
            @Param("staffType") String staffType,
            @Param("startTime") java.time.LocalDateTime startTime,
            @Param("endTime") java.time.LocalDateTime endTime
    );
}