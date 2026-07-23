package com.autowashpro.repository;

import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.enums.StaffType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StaffProfileRepository
        extends JpaRepository<StaffProfile, Long>, JpaSpecificationExecutor<StaffProfile> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT sp FROM StaffProfile sp WHERE sp.id = :id")
    Optional<StaffProfile> findByIdWithLock(@Param("id") Long id);

    boolean existsByUser_Id(Long userId);

    boolean existsByStaffCode(String staffCode);

    Optional<StaffProfile> findByUser_Id(Long userId);

    long countByGarageIdAndStaffTypeAndIsActiveTrue(
            Long garageId,
            StaffType staffType);

    List<StaffProfile> findByGarageIdAndStaffTypeAndIsActiveTrue(
            Long garageId,
            StaffType staffType);
}