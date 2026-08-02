package com.autowashpro.repository;

import com.autowashpro.entity.WaitlistAddOnServicePackage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WaitlistAddOnServicePackageRepository extends JpaRepository<WaitlistAddOnServicePackage, Long> {
    List<WaitlistAddOnServicePackage> findByWaitlistId(Long waitlistId);
}
