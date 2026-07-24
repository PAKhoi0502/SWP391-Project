package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class BookingSummaryResponse {

    private Long id;

    private Long customerId;

    private Long garageId;

    private Long vehicleId;

    private Long servicePackageId;

    private List<Long> addOnServicePackageIds;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private String status;

    private String paymentStatus;

    private String paymentMethod;

    private BigDecimal finalPrice;

    private Boolean isWalkIn;

    private String guestName;

    private String guestPhone;

    private String customerName;

    private String customerPhone;

    private String licensePlate;

    private String vehicleName;

    private Boolean rewardProcessed;

    private Integer pointsEarned;

    private String note;

    private LocalDateTime createdAt;

    private BigDecimal depositAmount;

    private String depositStatus;

    private Long depositTransactionId;

    private LocalDateTime paymentExpiredAt;

    private BigDecimal refundAmount;

    private Integer usedPoints;

    private LocalDateTime checkedInAt;

    private LocalDateTime completedAt;

    private LocalDateTime paidAt;

    // ── Operation phase fields (mirrors BookingResponse) ──────────────────
    private String operationPhase;

    private Long washBayId;

    private LocalDateTime plannedWashStartAt;

    private LocalDateTime plannedWashEndAt;

    private LocalDateTime plannedCareStartAt;

    private LocalDateTime plannedCareEndAt;

    private LocalDateTime careStartedAt;

    private LocalDateTime careCompletedAt;

    /** True when planned care window exists (i.e., the service requires care staff). */
    private Boolean requiresCareStaff;

    /** True when care staff is required but not yet fully reserved. Null on list responses. */
    private Boolean careStaffShortage;

    /**
     * 1-based sequential booking number for this customer (their 1st, 2nd, … booking).
     * Null for guest bookings (no customerId) and walk-in bookings without a linked account.
     */
    private Integer customerBookingNumber;
}
