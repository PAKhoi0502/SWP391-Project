package com.autowashpro.repository;

import com.autowashpro.entity.CustomerLoyalty;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CustomerLoyaltyRepository extends JpaRepository<CustomerLoyalty, Long> {
    Optional<CustomerLoyalty> findByCustomerId(Long customerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT cl FROM CustomerLoyalty cl WHERE cl.customerId = :customerId")
    Optional<CustomerLoyalty> findByCustomerIdWithLock(@Param("customerId") Long customerId);
}