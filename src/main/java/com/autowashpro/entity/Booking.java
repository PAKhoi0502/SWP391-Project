package com.autowashpro.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "bookings")
@Getter
@Setter
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_id")
    private Long customerId;

    @Column(name = "vehicle_id")
    private Long vehicleId;

    @Column(name = "garage_id")
    private Long garageId;

    @Column(name = "wash_bay_id")
    private Long washBayId;

    @Column(name = "service_package_id")
    private Long servicePackageId;

    @Column(name = "created_by_staff_id")
    private Long createdByStaffId;

    @Column(name = "promotion_id")
    private Long promotionId;

    @Column(name = "booking_date")
    private LocalDate bookingDate;

    @Column(name = "start_time")
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "wash_bay_start_time")
    private LocalDateTime washBayStartTime;

    @Column(name = "wash_bay_end_time")
    private LocalDateTime washBayEndTime;

    @Column(name = "status")
    private String status;

    @Column(name = "payment_status")
    private String paymentStatus;

    @Column(name = "payment_method")
    private String paymentMethod;

    @Column(name = "original_price")
    private BigDecimal originalPrice;

    @Column(name = "surcharge_amount")
    private BigDecimal surchargeAmount = BigDecimal.ZERO;

    @Column(name = "discount_amount")
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "final_price")
    private BigDecimal finalPrice;

    @Column(name = "deposit_amount")
    private BigDecimal depositAmount = BigDecimal.ZERO;

    @Column(name = "deposit_status")
    private String depositStatus = "UNPAID";

    @Column(name = "payment_expired_at")
    private LocalDateTime paymentExpiredAt;

    @Column(name = "original_start_time")
    private LocalDateTime originalStartTime;

    @Column(name = "rescheduled_at")
    private LocalDateTime rescheduledAt;

    @Column(name = "refund_amount")
    private BigDecimal refundAmount = BigDecimal.ZERO;

    @Column(name = "cancellation_policy_id")
    private Long cancellationPolicyId;

    @Column(name = "is_walk_in")
    private Boolean isWalkIn = false;

    @Column(name = "guest_name")
    private String guestName;

    @Column(name = "guest_phone")
    private String guestPhone;

    @Column(name = "license_plate")
    private String licensePlate;

    @Column(name = "reward_processed")
    private Boolean rewardProcessed = false;

    @Column(name = "note")
    private String note;

    @Column(name = "used_points")
    private Integer usedPoints = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}