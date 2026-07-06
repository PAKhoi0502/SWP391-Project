package com.autowashpro.service.impl;

import com.autowashpro.dto.request.AnalyticsFilterRequest;
import com.autowashpro.dto.response.LoyaltyAnalyticsResponse;
import com.autowashpro.dto.response.PromotionAnalyticsResponse;
import com.autowashpro.dto.response.RevenueAnalyticsResponse;
import com.autowashpro.dto.response.WashBayAnalyticsResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.entity.PointTransaction;
import com.autowashpro.entity.Promotion;
import com.autowashpro.entity.PromotionUsage;
import com.autowashpro.entity.WashBay;
import com.autowashpro.entity.enums.WashBayStatus;
import com.autowashpro.service.AnalyticsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@DataJpaTest
@Import(AnalyticsServiceImpl.class)
@ActiveProfiles("test")
class AnalyticsServiceImplTest {

    private static final LocalDate FROM = LocalDate.of(2026, 7, 1);
    private static final LocalDate TO = LocalDate.of(2026, 7, 31);
    private static final LocalDateTime BASE_TIME = LocalDateTime.of(2026, 7, 10, 9, 0);

    @Autowired
    private AnalyticsService analyticsService;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void rejectsInvalidDateRange() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> analyticsService.getRevenueStatistics(filter(TO, FROM, null)));

        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void revenueIncludesOnlyPaidCompletedBookings() {
        persistBooking(1L, "COMPLETED", "PAID", new BigDecimal("100000.00"), BASE_TIME, null, null, null);
        persistBooking(1L, "COMPLETED", "UNPAID", new BigDecimal("200000.00"), BASE_TIME.plusHours(1), null, null, null);
        persistBooking(1L, "CANCELED", "PAID", new BigDecimal("300000.00"), BASE_TIME.plusHours(2), null, null, null);
        persistBooking(1L, "NO_SHOW", "PAID", new BigDecimal("400000.00"), BASE_TIME.plusHours(3), null, null, null);
        persistBooking(2L, "COMPLETED", "PAID", new BigDecimal("500000.00"), BASE_TIME.plusHours(4), null, null, null);

        RevenueAnalyticsResponse allGarages = analyticsService.getRevenueStatistics(filter(FROM, TO, null));
        RevenueAnalyticsResponse garageOne = analyticsService.getRevenueStatistics(filter(FROM, TO, 1L));

        assertEquals(2L, allGarages.getPaidBookingCount());
        assertEquals(0, allGarages.getTotalRevenue().compareTo(new BigDecimal("600000.00")));
        assertEquals(1L, garageOne.getPaidBookingCount());
        assertEquals(0, garageOne.getTotalRevenue().compareTo(new BigDecimal("100000.00")));
    }

    @Test
    void promotionAnalyticsUsesPromotionUsageAndValidPaidBookings() {
        Promotion promotion = persistPromotion();
        Booking valid = persistBooking(1L, "COMPLETED", "PAID", new BigDecimal("100000.00"), BASE_TIME, null, null, null);
        Booking bookingOnlyPromotionId = persistBooking(1L, "COMPLETED", "PAID", new BigDecimal("120000.00"), BASE_TIME.plusHours(1), null, null, null);
        bookingOnlyPromotionId.setPromotionId(promotion.getId());
        entityManager.persistAndFlush(bookingOnlyPromotionId);
        Booking unpaid = persistBooking(1L, "COMPLETED", "UNPAID", new BigDecimal("130000.00"), BASE_TIME.plusHours(2), null, null, null);
        Booking canceled = persistBooking(1L, "CANCELED", "PAID", new BigDecimal("140000.00"), BASE_TIME.plusHours(3), null, null, null);
        persistPromotionUsage(promotion, valid, new BigDecimal("15000.00"));
        persistPromotionUsage(promotion, unpaid, new BigDecimal("25000.00"));
        persistPromotionUsage(promotion, canceled, new BigDecimal("35000.00"));

        PromotionAnalyticsResponse response = analyticsService.getPromotionPerformance(filter(FROM, TO, null));

        assertEquals(1L, response.getTotalUsages());
        assertEquals(0, response.getTotalDiscountAmount().compareTo(new BigDecimal("15000.00")));
        assertEquals(1, response.getPromotions().size());
        assertEquals(promotion.getId(), response.getPromotions().get(0).getPromotionId());
    }

    @Test
    void washBayPerformanceUsesActualCompletedAssignedUsage() {
        WashBay bay = persistWashBay(1L, "CAR-01");
        persistBooking(1L, "COMPLETED", "PAID", new BigDecimal("100000.00"), BASE_TIME, bay.getId(),
                BASE_TIME.plusMinutes(5), BASE_TIME.plusMinutes(50));
        persistBooking(1L, "COMPLETED", "PAID", new BigDecimal("110000.00"), BASE_TIME.plusHours(1),
                bay.getId(), null, null);
        persistBooking(1L, "CANCELED", "PAID", new BigDecimal("120000.00"), BASE_TIME.plusHours(2),
                bay.getId(), BASE_TIME.plusHours(2), BASE_TIME.plusHours(3));
        persistBooking(2L, "COMPLETED", "PAID", new BigDecimal("130000.00"), BASE_TIME.plusHours(3),
                bay.getId(), BASE_TIME.plusHours(3), BASE_TIME.plusHours(4));

        WashBayAnalyticsResponse response = analyticsService.getWashBayPerformance(filter(FROM, TO, 1L));

        assertEquals(1L, response.getTotalUsages());
        assertEquals(45L, response.getTotalUsageMinutes());
        assertEquals(1, response.getWashBays().size());
        assertEquals(bay.getId(), response.getWashBays().get(0).getWashBayId());
    }

    @Test
    void loyaltyAggregatesMemberTiersAndPointTransactions() {
        persistLoyalty(1L, "BRONZE", 100, 20, 0, new BigDecimal("100000.00"), 1);
        persistLoyalty(2L, "GOLD", 300, 50, 0, new BigDecimal("500000.00"), 3);
        persistPointTransaction(1L, null, "EARN", 40, BASE_TIME);
        persistPointTransaction(1L, null, "REDEEM", -20, BASE_TIME.plusHours(1));

        LoyaltyAnalyticsResponse response = analyticsService.getLoyaltyStatistics(filter(FROM, TO, null));

        assertEquals(2L, response.getTotalMembers());
        assertEquals(400, response.getTotalAvailablePoints());
        assertEquals(70, response.getTotalRedeemedPoints());
        assertEquals(40, response.getPointTransactionsByType().get("EARN").getPoints());
        assertEquals(-20, response.getPointTransactionsByType().get("REDEEM").getPoints());
    }

    private Booking persistBooking(Long garageId, String status, String paymentStatus, BigDecimal finalPrice,
                                   LocalDateTime time, Long washBayId, LocalDateTime washBayStart,
                                   LocalDateTime washBayEnd) {
        Booking booking = new Booking();
        booking.setCustomerId(garageId);
        booking.setVehicleId(100L + garageId);
        booking.setGarageId(garageId);
        booking.setWashBayId(washBayId);
        booking.setServicePackageId(1L);
        booking.setBookingDate(time.toLocalDate());
        booking.setStartTime(time);
        booking.setEndTime(time.plusMinutes(60));
        booking.setStatus(status);
        booking.setPaymentStatus(paymentStatus);
        booking.setPaymentMethod("PAID".equals(paymentStatus) ? "CASH" : null);
        booking.setOriginalPrice(finalPrice);
        booking.setSurchargeAmount(BigDecimal.ZERO);
        booking.setDiscountAmount(BigDecimal.ZERO);
        booking.setPromotionDiscountAmount(BigDecimal.ZERO);
        booking.setFinalPrice(finalPrice);
        booking.setDepositAmount(BigDecimal.ZERO);
        booking.setDepositStatus("UNPAID");
        booking.setRefundAmount(BigDecimal.ZERO);
        booking.setIsWalkIn(false);
        booking.setRewardProcessed(false);
        booking.setUsedPoints(0);
        booking.setWashBayStartTime(washBayStart);
        booking.setWashBayEndTime(washBayEnd);
        if ("COMPLETED".equals(status)) {
            booking.setCompletedAt(time.plusMinutes(60));
        }
        if ("PAID".equals(paymentStatus)) {
            booking.setPaidAt(time.plusMinutes(70));
        }
        return entityManager.persistAndFlush(booking);
    }

    private AnalyticsFilterRequest filter(LocalDate from, LocalDate to, Long garageId) {
        return AnalyticsFilterRequest.builder()
                .from(from)
                .to(to)
                .garageId(garageId)
                .build();
    }

    private Promotion persistPromotion() {
        Promotion promotion = new Promotion();
        promotion.setCode("SUMMER31");
        promotion.setName("Summer Discount");
        promotion.setDiscountType("FIXED");
        promotion.setDiscountValue(new BigDecimal("15000.00"));
        promotion.setUsedCount(0);
        promotion.setStartAt(FROM.atStartOfDay());
        promotion.setEndAt(TO.plusDays(1).atStartOfDay());
        promotion.setIsActive(true);
        promotion.setAllowLoyaltyStack(false);
        return entityManager.persistAndFlush(promotion);
    }

    private PromotionUsage persistPromotionUsage(Promotion promotion, Booking booking, BigDecimal discountAmount) {
        PromotionUsage usage = new PromotionUsage();
        usage.setPromotionId(promotion.getId());
        usage.setBookingId(booking.getId());
        usage.setCustomerId(booking.getCustomerId());
        usage.setDiscountAmount(discountAmount);
        usage.setUsedAt(BASE_TIME);
        return entityManager.persistAndFlush(usage);
    }

    private WashBay persistWashBay(Long garageId, String bayCode) {
        WashBay washBay = new WashBay();
        washBay.setGarageId(garageId);
        washBay.setBayCode(bayCode);
        washBay.setVehicleType("CAR");
        washBay.setStatus(WashBayStatus.AVAILABLE);
        washBay.setIsActive(true);
        return entityManager.persistAndFlush(washBay);
    }

    private CustomerLoyalty persistLoyalty(Long customerId, String tier, int availablePoints, int redeemedPoints,
                                           int expiredPoints, BigDecimal totalSpent, int totalVisits) {
        CustomerLoyalty loyalty = new CustomerLoyalty();
        loyalty.setCustomerId(customerId);
        loyalty.setCurrentTier(tier);
        loyalty.setTotalPoints(availablePoints + redeemedPoints + expiredPoints);
        loyalty.setAvailablePoints(availablePoints);
        loyalty.setRedeemedPoints(redeemedPoints);
        loyalty.setExpiredPoints(expiredPoints);
        loyalty.setTotalSpent(totalSpent);
        loyalty.setTotalVisits(totalVisits);
        loyalty.setCurrentCycleSpent(totalSpent);
        loyalty.setCurrentCycleVisits(totalVisits);
        return entityManager.persistAndFlush(loyalty);
    }

    private PointTransaction persistPointTransaction(Long customerId, Long bookingId, String type, int points,
                                                     LocalDateTime createdAt) {
        PointTransaction transaction = new PointTransaction();
        transaction.setCustomerId(customerId);
        transaction.setBookingId(bookingId);
        transaction.setType(type);
        transaction.setPoints(points);
        transaction.setRemainingPoints(points);
        transaction.setSource("TEST");
        transaction.setNote("analytics test");
        PointTransaction saved = entityManager.persistAndFlush(transaction);
        entityManager.getEntityManager()
                .createQuery("UPDATE PointTransaction t SET t.createdAt = :createdAt WHERE t.id = :id")
                .setParameter("createdAt", createdAt)
                .setParameter("id", saved.getId())
                .executeUpdate();
        entityManager.clear();
        return saved;
    }
}
