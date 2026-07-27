package com.autowashpro.repository;

import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.repository.projection.TopCustomerProjection;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    @Query(value = """
            SELECT cl.customer_id AS customerId,
                   u.full_name AS fullName,
                   u.email AS email,
                   u.phone AS phone,
                   cl.current_tier AS currentTier,
                   cl.total_visits AS totalVisits,
                   cl.total_points AS totalPoints,
                   cl.total_spent AS totalSpent
            FROM customer_loyalties cl
            JOIN users u ON u.id = cl.customer_id AND u.role = 'CUSTOMER'
            LEFT JOIN loyalty_tier_rules r ON r.tier = cl.current_tier
            WHERE (:tier IS NULL OR cl.current_tier = :tier)
              AND (:licensePlate IS NULL OR EXISTS (
                    SELECT 1 FROM vehicles v
                    WHERE v.customer_id = cl.customer_id
                      AND v.is_active = 1
                      AND v.normalized_license_plate LIKE CONCAT('%', :licensePlate, '%')
              ))
            ORDER BY COALESCE(r.priority_level, 0) DESC, cl.total_visits DESC
            """,
            countQuery = """
            SELECT COUNT(*)
            FROM customer_loyalties cl
            JOIN users u ON u.id = cl.customer_id AND u.role = 'CUSTOMER'
            WHERE (:tier IS NULL OR cl.current_tier = :tier)
              AND (:licensePlate IS NULL OR EXISTS (
                    SELECT 1 FROM vehicles v
                    WHERE v.customer_id = cl.customer_id
                      AND v.is_active = 1
                      AND v.normalized_license_plate LIKE CONCAT('%', :licensePlate, '%')
              ))
            """,
            nativeQuery = true)
    Page<TopCustomerProjection> findTopCustomers(
            @Param("tier") String tier,
            @Param("licensePlate") String licensePlate,
            Pageable pageable);
}