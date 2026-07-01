package com.autowashpro.repository;

import com.autowashpro.entity.PromotionUsage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PromotionUsageRepository
        extends JpaRepository<PromotionUsage, Long> {

    boolean existsByBookingId(Long bookingId);

    long countByPromotionId(Long promotionId);

    long countByPromotionIdAndCustomerId(
            Long promotionId,
            Long customerId);

    List<PromotionUsage> findByPromotionId(Long promotionId);

    List<PromotionUsage> findByCustomerId(Long customerId);

}