package com.autowashpro.repository;

import com.autowashpro.entity.LoyaltyTierRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LoyaltyTierRuleRepository extends JpaRepository<LoyaltyTierRule, Long> {
    Optional<LoyaltyTierRule> findByTierAndIsActiveTrue(String tier);
}