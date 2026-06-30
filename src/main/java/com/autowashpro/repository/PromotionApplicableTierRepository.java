package com.autowashpro.repository;

import com.autowashpro.entity.PromotionApplicableTier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PromotionApplicableTierRepository
        extends JpaRepository<PromotionApplicableTier, Long> {

    List<PromotionApplicableTier> findByPromotionId(Long promotionId);

    void deleteByPromotionId(Long promotionId);

}