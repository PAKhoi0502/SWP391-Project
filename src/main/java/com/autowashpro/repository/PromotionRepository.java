package com.autowashpro.repository;

import com.autowashpro.entity.Promotion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PromotionRepository
        extends JpaRepository<Promotion, Long> {

    Optional<Promotion> findByCodeAndIsActiveTrue(String code);

    Optional<Promotion> findByIdAndIsActiveTrue(Long id);

    List<Promotion> findByIsActiveTrue();

    boolean existsByCode(String code);

}