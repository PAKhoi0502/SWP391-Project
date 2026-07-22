package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class BookingResponse {
    private Long id;
    private Long customerId;
    private Long vehicleId;
    private Long garageId;
    private Long servicePackageId;
    private List<Long> addOnServicePackageIds;
    private Long promotionId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private LocalDateTime checkedInAt;
    private String status;
    private String paymentStatus;
    private String paymentMethod;
    private BigDecimal originalPrice;
    private BigDecimal discountAmount;
    private BigDecimal finalPrice;
    private BigDecimal depositAmount;
    private String depositStatus;
    private LocalDateTime depositPaidAt;
    private Long depositTransactionId;
    private String depositCheckoutUrl;
    private String depositQrCode;
    private BigDecimal refundAmount;
    private Boolean isWalkIn;
    private Integer usedPoints;
    private String note;
    private LocalDateTime createdAt;
    private String guestName;
    private String guestPhone;
    private String licensePlate;
    private Long createdByStaffId;
    private LocalDateTime startedAt;
    private Long washBayId;
    private LocalDateTime washBayStartTime;
    private LocalDateTime washBayEndTime;
    private LocalDateTime completedAt;
    private LocalDateTime paidAt;
    private Boolean rewardProcessed;
    private Integer pointsEarned;

    private List<Long> assignedCareStaffIds;

    // ===================== ISSUE #169 Operation Phase =====================
    private String operationPhase;
    private LocalDateTime plannedWashStartAt;
    private LocalDateTime plannedWashEndAt;
    private LocalDateTime plannedCareStartAt;
    private LocalDateTime plannedCareEndAt;
    private LocalDateTime careStartedAt;
    private LocalDateTime careCompletedAt;

    /** True when the booking's service requires vehicle care staff (AFTER_WASH inspection needed). */
    private Boolean requiresCareStaff;

    /** True when care staff is required but fewer RESERVED/ACTIVE assignments exist than required. */
    private Boolean careStaffShortage;

    /** Deadline for deposit payment; null when not applicable. */
    private LocalDateTime paymentExpiredAt;

    /**
     * 1-based sequential booking number for this customer (their 1st, 2nd, … booking).
     * Null for guest bookings (no customerId) and walk-in bookings without a linked account.
     */
    private Integer customerBookingNumber;
}
