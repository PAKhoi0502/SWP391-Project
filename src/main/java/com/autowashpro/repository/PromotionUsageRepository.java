package com.autowashpro.repository;

import com.autowashpro.entity.PromotionUsage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PromotionUsageRepository
        extends JpaRepository<PromotionUsage, Long> {

    boolean existsByBookingId(Long bookingId);

    boolean existsByPromotionId(Long promotionId);

    Optional<PromotionUsage> findByBookingId(Long bookingId);

    long countByPromotionId(Long promotionId);

    long countByPromotionIdAndCustomerId(
            Long promotionId,
            Long customerId);

    List<PromotionUsage> findByPromotionId(Long promotionId);

    List<PromotionUsage> findByCustomerId(Long customerId);

}