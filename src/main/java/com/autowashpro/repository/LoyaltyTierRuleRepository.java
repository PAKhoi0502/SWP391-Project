package com.autowashpro.repository;

import com.autowashpro.entity.LoyaltyTierRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LoyaltyTierRuleRepository
        extends JpaRepository<LoyaltyTierRule, Long> {

    Optional<LoyaltyTierRule> findByTier(String tier);

    Optional<LoyaltyTierRule> findByTierAndIsActiveTrue(String tier);

    List<LoyaltyTierRule> findByIsActiveTrueOrderByPriorityLevelAsc();

    List<LoyaltyTierRule> findByIsActiveTrueOrderByPriorityLevelDesc();

    List<LoyaltyTierRule> findAllByOrderByPriorityLevelAsc();
}