package com.autowashpro.repository;

import com.autowashpro.entity.StaffProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface StaffProfileRepository
        extends JpaRepository<StaffProfile, Long>, JpaSpecificationExecutor<StaffProfile> {

    boolean existsByUser_Id(Long userId);
    boolean existsByStaffCode(String staffCode);
    Optional<StaffProfile> findByUser_Id(Long userId);
}