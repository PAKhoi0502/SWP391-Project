
package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CreatePromotionRequest;
import com.autowashpro.dto.request.PromotionValidateRequest;
import com.autowashpro.dto.request.UpdatePromotionRequest;
import com.autowashpro.dto.response.PromotionDetailResponse;
import com.autowashpro.dto.response.PromotionResponse;
import com.autowashpro.dto.response.PromotionUsageResponse;
import com.autowashpro.dto.response.PromotionValidateResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.entity.Promotion;
import com.autowashpro.entity.PromotionApplicableTier;
import com.autowashpro.entity.PromotionUsage;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.CustomerLoyaltyRepository;
import com.autowashpro.repository.PromotionApplicableTierRepository;
import com.autowashpro.repository.PromotionRepository;
import com.autowashpro.repository.PromotionUsageRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.service.NotificationService;
import com.autowashpro.service.PromotionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.autowashpro.dto.request.SendVoucherRequest;


import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PromotionServiceImpl implements PromotionService {

    private final PromotionRepository promotionRepository;
    private final PromotionApplicableTierRepository promotionApplicableTierRepository;
    private final CustomerLoyaltyRepository customerLoyaltyRepository;
    private final PromotionUsageRepository promotionUsageRepository;
    private final BookingRepository bookingRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;


    private PromotionResponse map(Promotion promotion) {

        return PromotionResponse.builder()
                .id(promotion.getId())
                .code(promotion.getCode())
                .name(promotion.getName())
                .description(promotion.getDescription())
                .discountType(promotion.getDiscountType())
                .discountValue(promotion.getDiscountValue())
                .isActive(promotion.getIsActive())
                .allowLoyaltyStack(promotion.getAllowLoyaltyStack())
                .maxLoyaltyPoints(promotion.getMaxLoyaltyPoints())
                .startAt(promotion.getStartAt())
                .endAt(promotion.getEndAt())
                .perUserLimit(promotion.getPerUserLimit())
                .applicableTiers(
                        promotionApplicableTierRepository.findByPromotionId(promotion.getId())
                                .stream()
                                .map(t -> t.getTier())
                                .toList()
                )
                .build();
    }

    private PromotionUsageResponse map(PromotionUsage usage) {

        return PromotionUsageResponse.builder()
                .id(usage.getId())
                .promotionId(usage.getPromotionId())
                .bookingId(usage.getBookingId())
                .customerId(usage.getCustomerId())
                .discountAmount(usage.getDiscountAmount())
                .usedAt(usage.getUsedAt())
                .build();
    }

    @Override
    @Transactional
    public PromotionResponse createPromotion(CreatePromotionRequest request) {

        if (promotionRepository.existsByCode(request.getCode())) {
            throw new RuntimeException("Promotion code already exists");
        }

        Promotion promotion = new Promotion();

        promotion.setCode(request.getCode());
        promotion.setName(request.getName());
        promotion.setDescription(request.getDescription());
        promotion.setDiscountType(request.getDiscountType());
        promotion.setDiscountValue(request.getDiscountValue());
        promotion.setMaxDiscountAmount(request.getMaxDiscountAmount());
        promotion.setMinOrderAmount(request.getMinOrderAmount());
        promotion.setUsageLimit(request.getUsageLimit());
        promotion.setPerUserLimit(request.getPerUserLimit());
        promotion.setStartAt(request.getStartAt());
        promotion.setEndAt(request.getEndAt());
        promotion.setIsActive(
                request.getIsActive() != null
                        ? request.getIsActive()
                        : true);
        promotion.setAllowLoyaltyStack(
                request.getAllowLoyaltyStack() != null
                        ? request.getAllowLoyaltyStack()
                        : false);
        promotion.setMaxLoyaltyPoints(request.getMaxLoyaltyPoints());

        promotion = promotionRepository.save(promotion);

        promotionApplicableTierRepository.deleteByPromotionId(promotion.getId());

        if (request.getApplicableTiers() != null) {

            for (String tier : request.getApplicableTiers()) {

                PromotionApplicableTier item = new PromotionApplicableTier();

                item.setPromotionId(promotion.getId());
                item.setTier(tier);

                promotionApplicableTierRepository.save(item);
            }
        }

        return map(promotion);
    }

    @Override
    @Transactional
    public PromotionResponse updatePromotion(Long id,
            UpdatePromotionRequest request) {

        Promotion promotion = promotionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Promotion not found"));

        promotion.setName(request.getName());
        promotion.setDescription(request.getDescription());
        promotion.setDiscountType(request.getDiscountType());
        promotion.setDiscountValue(request.getDiscountValue());
        promotion.setMaxDiscountAmount(request.getMaxDiscountAmount());
        promotion.setMinOrderAmount(request.getMinOrderAmount());
        promotion.setUsageLimit(request.getUsageLimit());
        promotion.setPerUserLimit(request.getPerUserLimit());
        promotion.setStartAt(request.getStartAt());
        promotion.setEndAt(request.getEndAt());
        if (request.getAllowLoyaltyStack() != null) {
            promotion.setAllowLoyaltyStack(request.getAllowLoyaltyStack());
        }
        promotion.setMaxLoyaltyPoints(request.getMaxLoyaltyPoints());

        promotionRepository.save(promotion);

        promotionApplicableTierRepository.deleteByPromotionId(id);
        promotionApplicableTierRepository.flush();

        if (request.getApplicableTiers() != null) {

            for (String tier : request.getApplicableTiers()) {

                PromotionApplicableTier item = new PromotionApplicableTier();

                item.setPromotionId(id);
                item.setTier(tier);

                promotionApplicableTierRepository.save(item);
            }
        }

        return map(promotion);
    }

    @Override
    @Transactional
    public PromotionResponse updatePromotionStatus(Long id,
            Boolean active) {

        Promotion promotion = promotionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Promotion not found"));

        promotion.setIsActive(active);

        promotionRepository.save(promotion);

        return map(promotion);
    }

    @Override
    public List<PromotionResponse> getActivePromotions() {

        return promotionRepository.findByIsActiveTrue()
                .stream()
                .map(this::map)
                .toList();
    }

    @Override
    public PromotionDetailResponse getPromotion(Long id) {

        Promotion promotion = promotionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Promotion not found"));

        List<String> tiers = promotionApplicableTierRepository
                .findByPromotionId(id)
                .stream()
                .map(PromotionApplicableTier::getTier)
                .toList();

        return PromotionDetailResponse.builder()
                .id(promotion.getId())
                .code(promotion.getCode())
                .name(promotion.getName())
                .description(promotion.getDescription())
                .discountType(promotion.getDiscountType())
                .discountValue(promotion.getDiscountValue())
                .maxDiscountAmount(promotion.getMaxDiscountAmount())
                .minOrderAmount(promotion.getMinOrderAmount())
                .usageLimit(promotion.getUsageLimit())
                .usedCount(promotion.getUsedCount())
                .perUserLimit(promotion.getPerUserLimit())
                .startAt(promotion.getStartAt())
                .endAt(promotion.getEndAt())
                .isActive(promotion.getIsActive())
                .allowLoyaltyStack(promotion.getAllowLoyaltyStack())
                .maxLoyaltyPoints(promotion.getMaxLoyaltyPoints())
                .applicableTiers(tiers)
                .build();
    }

    private void validateDate(Promotion promotion) {

        LocalDateTime now = LocalDateTime.now();

        if (!Boolean.TRUE.equals(promotion.getIsActive())) {
            throw new RuntimeException("Promotion is inactive");
        }

        if (promotion.getStartAt().isAfter(now)) {
            throw new RuntimeException("Promotion has not started");
        }

        if (promotion.getEndAt().isBefore(now)) {
            throw new RuntimeException("Promotion has expired");
        }
    }

    private void validateUsage(Promotion promotion) {

        if (promotion.getUsageLimit() == null) {
            return;
        }

        if (promotion.getUsedCount() >= promotion.getUsageLimit()) {
            throw new RuntimeException("Promotion usage limit reached");
        }
    }

    private void validatePerUser(Promotion promotion,
            Long customerId) {

        if (promotion.getPerUserLimit() == null) {
            return;
        }

        long recordedUsages = promotionUsageRepository
                .countByPromotionIdAndCustomerId(
                        promotion.getId(),
                        customerId);

        long pendingUsages = bookingRepository
                .countByPromotionIdAndCustomerIdAndStatusNot(
                        promotion.getId(),
                        customerId,
                        "CANCELED");

        if (recordedUsages + pendingUsages >= promotion.getPerUserLimit()) {
            throw new RuntimeException("Promotion per-user limit reached");
        }
    }

    private void validateTier(Promotion promotion,
            Long customerId) {

        List<String> tiers = promotionApplicableTierRepository
                .findByPromotionId(promotion.getId())
                .stream()
                .map(PromotionApplicableTier::getTier)
                .toList();

        if (tiers.isEmpty()) {
            return;
        }

        CustomerLoyalty loyalty = customerLoyaltyRepository
                .findByCustomerId(customerId)
                .orElse(null);

        String customerTier = loyalty == null
                ? "BRONZE"
                : loyalty.getCurrentTier();

        if (!tiers.contains(customerTier)) {
            throw new RuntimeException("Your tier is not eligible");
        }
    }

    private BigDecimal calculateDiscount(Promotion promotion,
            BigDecimal orderAmount) {

        BigDecimal discount;

        if ("PERCENT".equalsIgnoreCase(promotion.getDiscountType())
                || "PERCENTAGE".equalsIgnoreCase(promotion.getDiscountType())) {

            discount = orderAmount
                    .multiply(promotion.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

            if (promotion.getMaxDiscountAmount() != null) {
                discount = discount.min(promotion.getMaxDiscountAmount());
            }

        } else {

            discount = promotion.getDiscountValue();
        }

        if (discount.compareTo(orderAmount) > 0) {
            discount = orderAmount;
        }

        return discount;
    }

    @Override
    public PromotionValidateResponse validatePromotion(
            Long customerId,
            PromotionValidateRequest request) {

        Promotion promotion = promotionRepository
                .findByCodeAndIsActiveTrue(request.getPromotionCode())
                .orElseThrow(() -> new RuntimeException("Promotion not found"));

        validateDate(promotion);

        validateUsage(promotion);

        validatePerUser(
                promotion,
                customerId);

        validateTier(
                promotion,
                customerId);

        if (promotion.getMinOrderAmount() != null
                && request.getOrderAmount()
                        .compareTo(promotion.getMinOrderAmount()) < 0) {

            throw new RuntimeException(
                    "Order amount does not meet minimum requirement");
        }

        BigDecimal discount = calculateDiscount(
                promotion,
                request.getOrderAmount());

        return PromotionValidateResponse.builder()
                .valid(true)
                .message("Promotion is valid")
                .promotionId(promotion.getId())
                .promotionCode(promotion.getCode())
                .discountAmount(discount)
                .finalAmount(
                        request.getOrderAmount()
                                .subtract(discount))
                .allowLoyaltyStack(promotion.getAllowLoyaltyStack())
                .maxLoyaltyPoints(promotion.getMaxLoyaltyPoints())
                .build();
    }

    @Override
    public List<PromotionResponse> getEligiblePromotions(
            Long customerId,
            Long servicePackageId,
            BigDecimal orderAmount) {

        return promotionRepository
                .findByIsActiveTrue()
                .stream()
                .filter(promotion -> {

                    try {

                        validateDate(promotion);

                        validateUsage(promotion);

                        validatePerUser(
                                promotion,
                                customerId);

                        validateTier(
                                promotion,
                                customerId);

                        if (promotion.getMinOrderAmount() != null
                                && orderAmount.compareTo(
                                        promotion.getMinOrderAmount()) < 0) {

                            return false;
                        }

                        return true;

                    } catch (Exception ex) {

                        return false;
                    }

                })
                .map(this::map)
                .toList();
    }

    @Override
    @Transactional
    public void recordPromotionUsageAfterPaidBooking(Long bookingId) {

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!"COMPLETED".equals(booking.getStatus())) {
            return;
        }

        if (!"PAID".equals(booking.getPaymentStatus())) {
            return;
        }

        if (booking.getPromotionId() == null) {
            return;
        }

        if (promotionUsageRepository.existsByBookingId(bookingId)) {
            return;
        }

        Promotion promotion = promotionRepository.findById(booking.getPromotionId())
                .orElseThrow(() -> new RuntimeException("Promotion not found"));

        PromotionUsage usage = new PromotionUsage();

        usage.setPromotionId(promotion.getId());
        usage.setBookingId(booking.getId());
        usage.setCustomerId(booking.getCustomerId());
        usage.setDiscountAmount(
                booking.getPromotionDiscountAmount());
        usage.setUsedAt(LocalDateTime.now());

        promotionUsageRepository.save(usage);

        promotion.setUsedCount(promotion.getUsedCount() + 1);

        promotionRepository.save(promotion);

    }

    @Override
    public List<PromotionUsageResponse> getAllPromotionUsages() {

        return promotionUsageRepository.findAll()
                .stream()
                .map(this::map)
                .toList();

    }

    @Override
    public List<PromotionUsageResponse> getPromotionUsages(
            Long promotionId) {

        return promotionUsageRepository
                .findByPromotionId(promotionId)
                .stream()
                .map(this::map)
                .toList();

    }

    @Override
    public List<PromotionUsageResponse> getMyPromotionUsages(
            Long customerId) {

        return promotionUsageRepository
                .findByCustomerId(customerId)
                .stream()
                .map(this::map)
                .toList();

    }

    @Override
    @Transactional
    public void deletePromotion(Long id) {
        if (!promotionRepository.existsById(id)) {
            throw new RuntimeException("Promotion not found");
        }
        boolean hasUsages = promotionUsageRepository.existsByPromotionId(id);
        if (hasUsages) {
            throw new RuntimeException("Không thể xóa khuyến mãi đã có lịch sử sử dụng");
        }
        long activeBookings = bookingRepository.countByPromotionIdAndStatusNot(id, "CANCELED");
        if (activeBookings > 0) {
            throw new RuntimeException("Không thể xóa khuyến mãi đang được dùng trong booking");
        }
        promotionApplicableTierRepository.deleteByPromotionId(id);
        promotionApplicableTierRepository.flush();
        promotionRepository.deleteById(id);
    }

    @Override
@Transactional
public int sendVoucher(Long promotionId, SendVoucherRequest request) {
    Promotion promotion = promotionRepository.findById(promotionId)
            .orElseThrow(() -> new RuntimeException("Promotion not found"));

    List<CustomerLoyalty> targets;

    switch (request.getFilterType().toUpperCase()) {
        case "MIN_VISITS" -> targets = customerLoyaltyRepository.findAll().stream()
                .filter(l -> l.getTotalVisits() >= request.getMinVisits())
                .toList();
        case "MIN_SPENT" -> targets = customerLoyaltyRepository.findAll().stream()
                .filter(l -> l.getTotalSpent().compareTo(request.getMinSpent()) >= 0)
                .toList();
        case "TIER" -> targets = customerLoyaltyRepository.findAll().stream()
                .filter(l -> request.getTier().equalsIgnoreCase(l.getCurrentTier()))
                .toList();
        default -> targets = customerLoyaltyRepository.findAll(); // ALL
    }

    int count = 0;
    for (CustomerLoyalty loyalty : targets) {
        notificationService.notifyVoucherReceived(
                loyalty.getCustomerId(),
                promotion.getCode(),
                promotion.getName()
        );
        count++;
    }

    return count;
}
}
