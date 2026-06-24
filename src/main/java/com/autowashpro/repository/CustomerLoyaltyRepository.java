package com.autowashpro.repository;

import com.autowashpro.entity.CustomerLoyalty;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CustomerLoyaltyRepository extends JpaRepository<CustomerLoyalty, Long> {
    Optional<CustomerLoyalty> findByCustomerId(Long customerId);
}