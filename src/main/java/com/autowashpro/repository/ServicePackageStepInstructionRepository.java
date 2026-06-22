package com.autowashpro.repository;

import com.autowashpro.entity.ServicePackageStepInstruction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ServicePackageStepInstructionRepository
        extends JpaRepository<ServicePackageStepInstruction, Long> {

    List<ServicePackageStepInstruction>
    findByServicePackageStep_IdOrderByInstructionOrder(
            Long stepId);
}