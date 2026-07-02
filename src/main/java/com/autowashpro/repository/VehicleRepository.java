package com.autowashpro.repository;

import com.autowashpro.entity.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface VehicleRepository
        extends JpaRepository<Vehicle, Long>, JpaSpecificationExecutor<Vehicle> {

    List<Vehicle> findByCustomer_IdAndIsActiveTrue(Long customerId);

    boolean existsByNormalizedLicensePlateAndIsActiveTrue(String normalizedLicensePlate);

    Optional<Vehicle> findByIdAndCustomer_Id(Long id, Long customerId);

    Optional<Vehicle> findByCustomer_IdAndNormalizedLicensePlateAndIsActiveTrue(Long customerId,
            String normalizedLicensePlate);

    // Reset tất cả xe của customer về is_default=false trước khi set default mới
    @Modifying
    @Query("UPDATE Vehicle v SET v.isDefault = false WHERE v.customer.id = :customerId")
    void clearDefaultByCustomerId(@Param("customerId") Long customerId);
}
