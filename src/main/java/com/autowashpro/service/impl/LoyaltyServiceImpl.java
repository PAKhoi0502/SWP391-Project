package com.autowashpro.service.impl;

import com.autowashpro.dto.response.LoyaltyOverviewResponse;
import com.autowashpro.dto.response.LoyaltyTierRuleResponse;
import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.entity.LoyaltyTierRule;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.CustomerLoyaltyRepository;
import com.autowashpro.repository.LoyaltyTierRuleRepository;
import com.autowashpro.repository.PointTransactionRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.service.EmailService;
import com.autowashpro.service.LoyaltyService;
import com.autowashpro.service.NotificationService;
import lombok.RequiredArgsConstructor;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.stereotype.Service;
import com.autowashpro.entity.Booking;
import java.time.LocalDateTime;
import com.autowashpro.dto.request.CreateLoyaltyTierRuleRequest;
import com.autowashpro.dto.request.UpdateLoyaltyTierRuleRequest;
import com.autowashpro.dto.request.RedeemPreviewRequest;
import com.autowashpro.dto.response.PointTransactionResponse;
import com.autowashpro.dto.response.RedeemPreviewResponse;
import com.autowashpro.entity.PointTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;
import java.math.RoundingMode;

@Service
@RequiredArgsConstructor
public class LoyaltyServiceImpl implements LoyaltyService {
    private final CustomerLoyaltyRepository customerLoyaltyRepository;
    private final LoyaltyTierRuleRepository loyaltyTierRuleRepository;
    private final BookingRepository bookingRepository;
    private final PointTransactionRepository pointTransactionRepository;
    private final ServicePackageRepository servicePackageRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final EmailService emailService;

    private static final List<String> TIER_ORDER = List.of("BRONZE", "SILVER", "GOLD", "PLATINUM");

    @Override
    public CustomerLoyalty getOrCreateCustomerLoyalty(Long customerId) {
        return customerLoyaltyRepository.findByCustomerId(customerId).orElseGet(() -> {
            CustomerLoyalty loyalty = new CustomerLoyalty();
            loyalty.setCustomerId(customerId);
            loyalty.setCurrentTier("BRONZE");
            loyalty.setTotalPoints(0);
            loyalty.setAvailablePoints(0);
            loyalty.setRedeemedPoints(0);
            loyalty.setExpiredPoints(0);
            loyalty.setTotalSpent(BigDecimal.ZERO);
            loyalty.setTotalVisits(0);
            loyalty.setCurrentCycleSpent(BigDecimal.ZERO);
            loyalty.setCurrentCycleVisits(0);
            return customerLoyaltyRepository.save(loyalty);
        });
    }

    @Override
    public LoyaltyOverviewResponse getMyLoyalty(Long customerId) {
        backfillMissingEarnPoints(customerId);
        CustomerLoyalty loyalty = getOrCreateCustomerLoyalty(customerId);
        return LoyaltyOverviewResponse.builder().currentTier(loyalty.getCurrentTier())
                .totalPoints(loyalty.getTotalPoints()).availablePoints(loyalty.getAvailablePoints())
                .redeemedPoints(loyalty.getRedeemedPoints()).expiredPoints(loyalty.getExpiredPoints())
                .totalSpent(loyalty.getTotalSpent()).totalVisits(loyalty.getTotalVisits()).build();
    }

    private void backfillMissingEarnPoints(Long customerId) {
        bookingRepository.findByCustomerIdOrderByStartTimeDesc(customerId).stream()
                .filter(booking -> "COMPLETED".equals(booking.getStatus()))
                .filter(booking -> "PAID".equals(booking.getPaymentStatus()))
                .filter(booking -> pointTransactionRepository
                        .findByBookingIdAndType(booking.getId(), "EARN")
                        .isEmpty())
                .forEach(booking -> {
                    // Backfill both statistics (totalSpent, totalVisits) AND earn points
                    updateBookingStatistics(booking.getId());
                    earnPointsAfterPaidBooking(booking.getId());
                });
    }

    @Override
    public List<LoyaltyTierRuleResponse> getTierRules() {
        return loyaltyTierRuleRepository.findByIsActiveTrueOrderByPriorityLevelAsc().stream()
                .map(rule -> LoyaltyTierRuleResponse.builder().tier(rule.getTier())
                        .minTotalSpent(rule.getMinTotalSpent()).minTotalVisits(rule.getMinTotalVisits())
                        .minTotalPoints(rule.getMinTotalPoints()).bookingWindowDays(rule.getBookingWindowDays())
                        .maxUpcomingBookings(rule.getMaxUpcomingBookings()).pointMultiplier(rule.getPointMultiplier())
                        .priorityLevel(rule.getPriorityLevel()).build())
                .toList();
    }

    @Override
    public void reviewCustomerTier(Long customerId) {
        CustomerLoyalty loyalty = getOrCreateCustomerLoyalty(customerId);
        String oldTier = loyalty.getCurrentTier();

        List<LoyaltyTierRule> rules = loyaltyTierRuleRepository.findByIsActiveTrueOrderByPriorityLevelDesc();

       final String[] newTierHolder = {"BRONZE"};
for (LoyaltyTierRule rule : rules) {
    boolean eligible = loyalty.getTotalSpent().compareTo(rule.getMinTotalSpent()) >= 0
            && loyalty.getTotalVisits() >= rule.getMinTotalVisits()
            && loyalty.getTotalPoints() >= rule.getMinTotalPoints();
    if (eligible) {
        newTierHolder[0] = rule.getTier();
        break;
    }
}
String newTier = newTierHolder[0];

        loyalty.setCurrentTier(newTier);
        customerLoyaltyRepository.save(loyalty);

        // Trigger TIER_UPGRADED nếu tier mới cao hơn tier cũ
        if (!newTier.equals(oldTier) && isTierHigher(newTier, oldTier)) {
            notificationService.notifyTierUpgraded(customerId, oldTier, newTier);

            userRepository.findById(customerId).ifPresent(user -> {
                if (user.getEmail() != null && !user.getEmail().isBlank()) {
                    emailService.sendTierUpgradedEmail(user.getEmail(), user.getFullName(), oldTier, newTier);
                }
            });
        }
    }

    private boolean isTierHigher(String newTier, String oldTier) {
        return TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(oldTier);
    }

    @Override
    public void updateBookingStatistics(Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!"COMPLETED".equals(booking.getStatus())) {
            return;
        }

        if (!"PAID".equals(booking.getPaymentStatus())) {
            return;
        }

        // Guest booking — skip
        if (booking.getCustomerId() == null) {
            return;
        }

        if (Boolean.TRUE.equals(booking.getRewardProcessed())) {
            return;
        }

        CustomerLoyalty loyalty = getOrCreateCustomerLoyalty(booking.getCustomerId());

        BigDecimal currentSpent = loyalty.getTotalSpent() != null
                ? loyalty.getTotalSpent() : java.math.BigDecimal.ZERO;
        loyalty.setTotalSpent(currentSpent.add(
                booking.getFinalPrice() != null ? booking.getFinalPrice() : java.math.BigDecimal.ZERO));

        int currentVisits = loyalty.getTotalVisits() != null ? loyalty.getTotalVisits() : 0;
        loyalty.setTotalVisits(currentVisits + 1);

        loyalty.setLastVisitAt(LocalDateTime.now());

        customerLoyaltyRepository.save(loyalty);

        booking.setRewardProcessed(true);
        bookingRepository.save(booking);
    }

    @Override
    public List<LoyaltyTierRuleResponse> getAdminTierRules() {
        return getTierRules();
    }

    @Override
    public LoyaltyTierRuleResponse createTierRule(CreateLoyaltyTierRuleRequest request) {
        if (loyaltyTierRuleRepository.findByTier(request.getTier()).isPresent()) {
            throw new RuntimeException("Tier already exists");
        }

        LoyaltyTierRule rule = new LoyaltyTierRule();
        rule.setTier(request.getTier().toUpperCase());
        rule.setMinTotalSpent(request.getMinTotalSpent());
        rule.setMinTotalVisits(request.getMinTotalVisits());
        rule.setMinTotalPoints(request.getMinTotalPoints());
        rule.setBookingWindowDays(request.getBookingWindowDays());
        rule.setMaxUpcomingBookings(request.getMaxUpcomingBookings());
        rule.setPointMultiplier(request.getPointMultiplier());
        rule.setPriorityLevel(request.getPriorityLevel());
        rule.setIsActive(true);
        loyaltyTierRuleRepository.save(rule);

        return LoyaltyTierRuleResponse.builder()
                .tier(rule.getTier())
                .minTotalSpent(rule.getMinTotalSpent())
                .minTotalVisits(rule.getMinTotalVisits())
                .minTotalPoints(rule.getMinTotalPoints())
                .bookingWindowDays(rule.getBookingWindowDays())
                .maxUpcomingBookings(rule.getMaxUpcomingBookings())
                .pointMultiplier(rule.getPointMultiplier())
                .priorityLevel(rule.getPriorityLevel())
                .build();
    }

    @Override
    public LoyaltyTierRuleResponse updateTierRule(Long id, UpdateLoyaltyTierRuleRequest request) {
        LoyaltyTierRule rule = loyaltyTierRuleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Tier rule not found"));

        rule.setMinTotalSpent(request.getMinTotalSpent());
        rule.setMinTotalVisits(request.getMinTotalVisits());
        rule.setMinTotalPoints(request.getMinTotalPoints());
        rule.setBookingWindowDays(request.getBookingWindowDays());
        rule.setMaxUpcomingBookings(request.getMaxUpcomingBookings());
        rule.setPointMultiplier(request.getPointMultiplier());
        rule.setPriorityLevel(request.getPriorityLevel());

        if (request.getIsActive() != null) {
            rule.setIsActive(request.getIsActive());
        }

        loyaltyTierRuleRepository.save(rule);

        return LoyaltyTierRuleResponse.builder()
                .tier(rule.getTier())
                .minTotalSpent(rule.getMinTotalSpent())
                .minTotalVisits(rule.getMinTotalVisits())
                .minTotalPoints(rule.getMinTotalPoints())
                .bookingWindowDays(rule.getBookingWindowDays())
                .maxUpcomingBookings(rule.getMaxUpcomingBookings())
                .pointMultiplier(rule.getPointMultiplier())
                .priorityLevel(rule.getPriorityLevel())
                .build();
    }

    // ===================== ISSUE #23 =====================

    @Override
    @Transactional
    public void earnPointsAfterPaidBooking(Long bookingId) {
        // Idempotent check
        if (pointTransactionRepository.findByBookingIdAndType(bookingId, "EARN").isPresent()) {
            return;
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found: " + bookingId));

        if (!"COMPLETED".equals(booking.getStatus()) || !"PAID".equals(booking.getPaymentStatus())) {
            return;
        }

        if (booking.getCustomerId() == null) {
            return;
        }

        CustomerLoyalty loyalty = getOrCreateCustomerLoyalty(booking.getCustomerId());

        LoyaltyTierRule tierRule = loyaltyTierRuleRepository
                .findByTierAndIsActiveTrue(loyalty.getCurrentTier())
                .orElse(null);

        double multiplier = tierRule != null ? tierRule.getPointMultiplier().doubleValue() : 1.0;

        com.autowashpro.entity.ServicePackage pkg = servicePackageRepository
                .findById(booking.getServicePackageId())
                .orElseThrow(() -> new RuntimeException("Service package not found"));

        BigDecimal originalPrice = booking.getOriginalPrice() != null && booking.getOriginalPrice().compareTo(BigDecimal.ZERO) > 0
                ? booking.getOriginalPrice()
                : booking.getFinalPrice();
        BigDecimal finalPrice = booking.getFinalPrice() != null
                ? booking.getFinalPrice()
                : originalPrice;

        if (originalPrice == null || originalPrice.compareTo(BigDecimal.ZERO) <= 0 || finalPrice == null) {
            return;
        }

        Integer basePoints = pkg.getPointsEarned();
        if (basePoints == null || basePoints <= 0) {
            // fallback dùng originalPrice để tránh double-discount (finalPrice đã trừ loyalty rồi)
            basePoints = originalPrice
                    .divide(BigDecimal.valueOf(10000), 0, RoundingMode.DOWN)
                    .intValue();
        }

        double ratio = finalPrice.doubleValue() / originalPrice.doubleValue();
        int earnedPoints = (int) Math.floor(basePoints * multiplier * ratio);

        if (earnedPoints <= 0) {
            return;
        }

        loyalty.setTotalPoints(loyalty.getTotalPoints() + earnedPoints);
        loyalty.setAvailablePoints(loyalty.getAvailablePoints() + earnedPoints);
        customerLoyaltyRepository.save(loyalty);

        PointTransaction pt = new PointTransaction();
        pt.setCustomerId(booking.getCustomerId());
        pt.setBookingId(bookingId);
        pt.setType("EARN");
        pt.setPoints(earnedPoints);
        pt.setRemainingPoints(earnedPoints);
        pt.setExpiredAt(LocalDateTime.now().plusMonths(12));
        pt.setSource("BOOKING_EARN");
        pt.setNote("Earned " + earnedPoints + " points from booking #" + bookingId);
        pointTransactionRepository.save(pt);

        // Review tier — sẽ trigger TIER_UPGRADED nếu đủ điều kiện
        reviewCustomerTier(booking.getCustomerId());
    }

    @Override
    @Transactional
    public void refundPointsForCanceledBooking(Long bookingId) {
        if (pointTransactionRepository.findByBookingIdAndType(bookingId, "REFUND").isPresent()) {
            return;
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found: " + bookingId));

        if (booking.getCustomerId() == null || booking.getUsedPoints() == null || booking.getUsedPoints() <= 0) {
            return;
        }

        if ("NO_SHOW".equals(booking.getStatus())) {
            return;
        }

        CustomerLoyalty loyalty = getOrCreateCustomerLoyalty(booking.getCustomerId());

        int refundPoints = booking.getUsedPoints();
        loyalty.setAvailablePoints(loyalty.getAvailablePoints() + refundPoints);
        loyalty.setRedeemedPoints(Math.max(0, loyalty.getRedeemedPoints() - refundPoints));
        customerLoyaltyRepository.save(loyalty);

        PointTransaction pt = new PointTransaction();
        pt.setCustomerId(booking.getCustomerId());
        pt.setBookingId(bookingId);
        pt.setType("REFUND");
        pt.setPoints(refundPoints);
        pt.setRemainingPoints(refundPoints);
        pt.setExpiredAt(LocalDateTime.now().plusMonths(12));
        pt.setSource("BOOKING_REFUND");
        pt.setNote("Refunded " + refundPoints + " points from canceled booking #" + bookingId);
        pointTransactionRepository.save(pt);
    }

    @Override
    @Transactional
    public void adjustPoints(Long customerId, Integer points, String type, String reason) {
        CustomerLoyalty loyalty = getOrCreateCustomerLoyalty(customerId);

        if (points > 0) {
            loyalty.setTotalPoints(loyalty.getTotalPoints() + points);
            loyalty.setAvailablePoints(loyalty.getAvailablePoints() + points);
        } else {
            int deduct = Math.abs(points);
            if (loyalty.getAvailablePoints() < deduct) {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_REQUEST,
                        "Insufficient points");
            }
            loyalty.setAvailablePoints(loyalty.getAvailablePoints() - deduct);
        }

        customerLoyaltyRepository.save(loyalty);

        PointTransaction pt = new PointTransaction();
        pt.setCustomerId(customerId);
        pt.setType(type);
        pt.setPoints(points);
        pt.setRemainingPoints(Math.max(0, points));
        pt.setSource("ADMIN_ADJUST");
        pt.setNote(reason);
        pointTransactionRepository.save(pt);

        // Review tier sau khi adjust points
    reviewCustomerTier(customerId);
    }

    @Override
    public Page<PointTransactionResponse> getMyTransactions(Long customerId, int page, int limit, String type) {
        PageRequest pageable = PageRequest.of(page - 1, limit);

        Page<PointTransaction> transactions;

        if (type != null && !type.isBlank()) {
            transactions = pointTransactionRepository
                    .findByCustomerIdAndTypeOrderByCreatedAtDesc(customerId, type, pageable);
        } else {
            transactions = pointTransactionRepository
                    .findByCustomerIdOrderByCreatedAtDesc(customerId, pageable);
        }

        return transactions.map(t -> PointTransactionResponse.builder()
                .id(t.getId())
                .customerId(t.getCustomerId())
                .bookingId(t.getBookingId())
                .type(t.getType())
                .points(t.getPoints())
                .remainingPoints(t.getRemainingPoints())
                .expiredAt(t.getExpiredAt())
                .source(t.getSource())
                .note(t.getNote())
                .createdAt(t.getCreatedAt())
                .build());
    }

    @Override
    public RedeemPreviewResponse redeemPreview(Long customerId, RedeemPreviewRequest request) {
        CustomerLoyalty loyalty = getOrCreateCustomerLoyalty(customerId);

        com.autowashpro.entity.ServicePackage pkg = servicePackageRepository
                .findById(request.getServicePackageId())
                .orElseThrow(() -> new RuntimeException("Service package not found"));

        int availablePoints = loyalty.getAvailablePoints();
        int requestedPoints = request.getPoints();

        if (requestedPoints > availablePoints) {
            throw new RuntimeException("Bạn không đủ điểm khả dụng để đổi.");
        }

        BigDecimal originalPrice = pkg.getBasePrice();
        BigDecimal eligibleAmount = request.getSubtotalAfterPromotion() != null
                ? request.getSubtotalAfterPromotion()
                : originalPrice;

        // max 50% of eligible amount AND final must remain >= 50,000đ
        BigDecimal maxByPercent = eligibleAmount.multiply(BigDecimal.valueOf(0.5));
        BigDecimal maxByMinPayable = eligibleAmount.subtract(BigDecimal.valueOf(50000));
        BigDecimal maxDiscount = maxByPercent.min(maxByMinPayable);
        if (maxDiscount.compareTo(BigDecimal.ZERO) < 0) maxDiscount = BigDecimal.ZERO;

        int maxPoints = maxDiscount.divide(BigDecimal.valueOf(1000), RoundingMode.DOWN).intValue();
        maxPoints = (maxPoints / 10) * 10;

        int validPoints = (requestedPoints / 10) * 10;
        validPoints = Math.max(0, validPoints);

        String message = null;
        if (validPoints > maxPoints) {
            validPoints = maxPoints;
            if (validPoints == 0) {
                message = String.format(
                    "Không thể áp dụng điểm loyalty. Giá trị đơn sau khuyến mãi (%.0fđ) quá thấp hoặc không đủ để áp dụng tối thiểu 10 điểm.",
                    eligibleAmount.doubleValue()
                );
            } else {
                message = String.format(
                    "Chỉ áp dụng tối đa %d điểm (giảm tối đa 50%% và giữ tổng thanh toán ≥ 50.000đ).",
                    validPoints
                );
            }
        }

        BigDecimal discountAmount = BigDecimal.valueOf(validPoints * 1000L);
        BigDecimal estimatedFinalPrice = eligibleAmount.subtract(discountAmount);

        return RedeemPreviewResponse.builder()
                .requestedPoints(requestedPoints)
                .validPoints(validPoints)
                .discountAmount(discountAmount)
                .originalPrice(originalPrice)
                .estimatedFinalPrice(estimatedFinalPrice)
                .message(message)
                .build();
    }
}
