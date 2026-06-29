package com.autowashpro.service.impl;

import com.autowashpro.dto.response.LoyaltyOverviewResponse;
import com.autowashpro.dto.response.LoyaltyTierRuleResponse;
import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.entity.LoyaltyTierRule;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.CustomerLoyaltyRepository;
import com.autowashpro.repository.LoyaltyTierRuleRepository;
import com.autowashpro.service.LoyaltyService;
import lombok.RequiredArgsConstructor;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.stereotype.Service;
import com.autowashpro.entity.Booking;
import java.time.LocalDateTime;
import com.autowashpro.dto.request.CreateLoyaltyTierRuleRequest;
import com.autowashpro.dto.request.UpdateLoyaltyTierRuleRequest;

@Service
@RequiredArgsConstructor
public class LoyaltyServiceImpl implements LoyaltyService {
    private final CustomerLoyaltyRepository customerLoyaltyRepository;
    private final LoyaltyTierRuleRepository loyaltyTierRuleRepository;
    private final BookingRepository bookingRepository;

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
        CustomerLoyalty loyalty = getOrCreateCustomerLoyalty(customerId);
        return LoyaltyOverviewResponse.builder().currentTier(loyalty.getCurrentTier())
                .totalPoints(loyalty.getTotalPoints()).availablePoints(loyalty.getAvailablePoints())
                .redeemedPoints(loyalty.getRedeemedPoints()).expiredPoints(loyalty.getExpiredPoints())
                .totalSpent(loyalty.getTotalSpent()).totalVisits(loyalty.getTotalVisits()).build();
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

        List<LoyaltyTierRule> rules = loyaltyTierRuleRepository.findByIsActiveTrueOrderByPriorityLevelDesc();

        for (LoyaltyTierRule rule : rules) {

            boolean eligible = loyalty.getTotalSpent().compareTo(rule.getMinTotalSpent()) >= 0
                    && loyalty.getTotalVisits() >= rule.getMinTotalVisits()
                    && loyalty.getTotalPoints() >= rule.getMinTotalPoints();

            if (eligible) {

                loyalty.setCurrentTier(rule.getTier());

                customerLoyaltyRepository.save(loyalty);

                return;
            }
        }

        loyalty.setCurrentTier("BRONZE");

        customerLoyaltyRepository.save(loyalty);
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

        if (Boolean.TRUE.equals(booking.getRewardProcessed())) {
            return;
        }

        CustomerLoyalty loyalty = getOrCreateCustomerLoyalty(booking.getCustomerId());

        loyalty.setTotalSpent(
                loyalty.getTotalSpent().add(booking.getFinalPrice()));

        loyalty.setTotalVisits(
                loyalty.getTotalVisits() + 1);

        loyalty.setLastVisitAt(LocalDateTime.now());

        customerLoyaltyRepository.save(loyalty);

        reviewCustomerTier(booking.getCustomerId());

        booking.setRewardProcessed(true);

        bookingRepository.save(booking);

    }

    @Override
    public List<LoyaltyTierRuleResponse> getAdminTierRules() {
        return getTierRules();
    }

    @Override
    public LoyaltyTierRuleResponse createTierRule(
            CreateLoyaltyTierRuleRequest request) {

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
    public LoyaltyTierRuleResponse updateTierRule(
            Long id,
            UpdateLoyaltyTierRuleRequest request) {

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
}