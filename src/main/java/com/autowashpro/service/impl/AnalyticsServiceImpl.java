package com.autowashpro.service.impl;

import com.autowashpro.dto.request.AnalyticsFilterRequest;
import com.autowashpro.dto.response.AnalyticsOverviewResponse;
import com.autowashpro.dto.response.BookingAnalyticsResponse;
import com.autowashpro.dto.response.LoyaltyAnalyticsResponse;
import com.autowashpro.dto.response.PromotionAnalyticsResponse;
import com.autowashpro.dto.response.RevenueAnalyticsResponse;
import com.autowashpro.dto.response.WashBayAnalyticsResponse;
import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.service.AnalyticsService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AnalyticsServiceImpl implements AnalyticsService {

    private final EntityManager entityManager;

    @Override
    public AnalyticsOverviewResponse getOverview(AnalyticsFilterRequest filter) {
        BookingAnalyticsResponse booking = getBookingStatistics(filter);
        RevenueAnalyticsResponse revenue = getRevenueStatistics(filter);
        LoyaltyAnalyticsResponse loyalty = getLoyaltyStatistics(filter);
        PromotionAnalyticsResponse promotion = getPromotionPerformance(filter);
        WashBayAnalyticsResponse washBay = getWashBayPerformance(filter);

        return AnalyticsOverviewResponse.builder()
                .from(booking.getFrom())
                .to(booking.getTo())
                .garageId(filter.getGarageId())
                .totalBookings(booking.getTotalBookings())
                .completedBookings(booking.getByStatus().getOrDefault("COMPLETED", 0L))
                .canceledBookings(booking.getByStatus().getOrDefault("CANCELED", 0L))
                .noShowBookings(booking.getByStatus().getOrDefault("NO_SHOW", 0L))
                .paidBookings(revenue.getPaidBookingCount())
                .totalRevenue(revenue.getTotalRevenue())
                .loyaltyMembers(loyalty.getTotalMembers())
                .totalAvailablePoints(loyalty.getTotalAvailablePoints())
                .totalRedeemedPoints(loyalty.getTotalRedeemedPoints())
                .promotionUsages(promotion.getTotalUsages())
                .promotionDiscountAmount(promotion.getTotalDiscountAmount())
                .washBayUsages(washBay.getTotalUsages())
                .washBayUsageMinutes(washBay.getTotalUsageMinutes())
                .build();
    }

    @Override
    public BookingAnalyticsResponse getBookingStatistics(AnalyticsFilterRequest filter) {
        AnalyticsRange range = validateRange(filter);
        Long garageId = filter.getGarageId();
        List<Object[]> statusRows = bindRangeAndGarage(entityManager.createQuery("""
                SELECT b.status, COUNT(b)
                FROM Booking b
                WHERE b.startTime >= :start
                  AND b.startTime < :end
                  AND (:garageId IS NULL OR b.garageId = :garageId)
                GROUP BY b.status
                """, Object[].class), range, garageId).getResultList();

        Map<String, Long> byStatus = new LinkedHashMap<>();
        long total = 0L;
        for (Object[] row : statusRows) {
            String status = row[0] != null ? row[0].toString() : "UNKNOWN";
            long count = asLong(row[1]);
            byStatus.put(status, count);
            total += count;
        }

        List<Object[]> garageRows = bindRangeAndGarage(entityManager.createQuery("""
                SELECT b.garageId, COUNT(b)
                FROM Booking b
                WHERE b.startTime >= :start
                  AND b.startTime < :end
                  AND (:garageId IS NULL OR b.garageId = :garageId)
                GROUP BY b.garageId
                ORDER BY b.garageId
                """, Object[].class), range, garageId).getResultList();

        List<BookingAnalyticsResponse.GarageBookingCount> byGarage = garageRows.stream()
                .map(row -> BookingAnalyticsResponse.GarageBookingCount.builder()
                        .garageId((Long) row[0])
                        .bookingCount(asLong(row[1]))
                        .build())
                .toList();

        List<Object[]> dateRows = entityManager.createQuery("""
                SELECT b.bookingDate, COUNT(b)
                FROM Booking b
                WHERE b.bookingDate >= :from
                  AND b.bookingDate <= :to
                  AND (:garageId IS NULL OR b.garageId = :garageId)
                GROUP BY b.bookingDate
                ORDER BY b.bookingDate
                """, Object[].class)
                .setParameter("from", range.from())
                .setParameter("to", range.to())
                .setParameter("garageId", garageId)
                .getResultList();

        List<BookingAnalyticsResponse.DateBookingCount> byDate = dateRows.stream()
                .map(row -> BookingAnalyticsResponse.DateBookingCount.builder()
                        .date((LocalDate) row[0])
                        .bookingCount(asLong(row[1]))
                        .build())
                .toList();

        return BookingAnalyticsResponse.builder()
                .from(range.from())
                .to(range.to())
                .garageId(garageId)
                .totalBookings(total)
                .byStatus(byStatus)
                .byGarage(byGarage)
                .byDate(byDate)
                .build();
    }

    @Override
    public RevenueAnalyticsResponse getRevenueStatistics(AnalyticsFilterRequest filter) {
        AnalyticsRange range = validateRange(filter);
        Long garageId = filter.getGarageId();
        List<Object[]> rows = bindRangeAndGarage(entityManager.createQuery("""
                SELECT b.garageId, b.paymentMethod, b.paidAt, b.finalPrice
                FROM Booking b
                WHERE b.status = 'COMPLETED'
                  AND b.paymentStatus = 'PAID'
                  AND b.paidAt >= :start
                  AND b.paidAt < :end
                  AND (:garageId IS NULL OR b.garageId = :garageId)
                """, Object[].class), range, garageId).getResultList();

        Map<LocalDate, RevenueBucket> byDateMap = new LinkedHashMap<>();
        Map<Long, RevenueBucket> byGarageMap = new LinkedHashMap<>();
        Map<String, RevenueBucket> byPaymentMethodMap = new LinkedHashMap<>();
        BigDecimal totalRevenue = BigDecimal.ZERO;

        for (Object[] row : rows) {
            Long rowGarageId = (Long) row[0];
            String paymentMethod = row[1] != null ? row[1].toString() : "UNKNOWN";
            LocalDate paidDate = ((LocalDateTime) row[2]).toLocalDate();
            BigDecimal amount = asBigDecimal(row[3]);
            totalRevenue = totalRevenue.add(amount);
            byDateMap.computeIfAbsent(paidDate, key -> new RevenueBucket()).add(amount);
            byGarageMap.computeIfAbsent(rowGarageId, key -> new RevenueBucket()).add(amount);
            byPaymentMethodMap.computeIfAbsent(paymentMethod, key -> new RevenueBucket()).add(amount);
        }

        long paidBookingCount = rows.size();

        return RevenueAnalyticsResponse.builder()
                .from(range.from())
                .to(range.to())
                .garageId(garageId)
                .paidBookingCount(paidBookingCount)
                .totalRevenue(totalRevenue)
                .averageRevenue(average(totalRevenue, paidBookingCount))
                .byDate(toDateRevenue(byDateMap))
                .byGarage(toGarageRevenue(byGarageMap))
                .byPaymentMethod(toPaymentMethodRevenue(byPaymentMethodMap))
                .build();
    }

    @Override
    public LoyaltyAnalyticsResponse getLoyaltyStatistics(AnalyticsFilterRequest filter) {
        AnalyticsRange range = validateRange(filter);
        Long garageId = filter.getGarageId();
        List<CustomerLoyalty> loyalties = loadLoyalties(range, garageId);
        Map<String, LoyaltyBucket> tierBuckets = new LinkedHashMap<>();
        int totalAvailablePoints = 0;
        int totalRedeemedPoints = 0;
        int totalExpiredPoints = 0;
        BigDecimal totalSpent = BigDecimal.ZERO;
        int totalVisits = 0;

        for (CustomerLoyalty loyalty : loyalties) {
            String tier = loyalty.getCurrentTier() != null ? loyalty.getCurrentTier() : "UNKNOWN";
            LoyaltyBucket bucket = tierBuckets.computeIfAbsent(tier, key -> new LoyaltyBucket());
            bucket.add(loyalty);
            totalAvailablePoints += valueOrZero(loyalty.getAvailablePoints());
            totalRedeemedPoints += valueOrZero(loyalty.getRedeemedPoints());
            totalExpiredPoints += valueOrZero(loyalty.getExpiredPoints());
            totalSpent = totalSpent.add(valueOrZero(loyalty.getTotalSpent()));
            totalVisits += valueOrZero(loyalty.getTotalVisits());
        }

        List<Object[]> pointRows = bindRangeAndGarage(entityManager.createQuery("""
                SELECT t.type, COUNT(t), COALESCE(SUM(t.points), 0)
                FROM PointTransaction t
                WHERE t.createdAt >= :start
                  AND t.createdAt < :end
                  AND (:garageId IS NULL OR EXISTS (
                      SELECT 1
                      FROM Booking b
                      WHERE b.id = t.bookingId
                        AND b.garageId = :garageId
                  ))
                GROUP BY t.type
                """, Object[].class), range, garageId).getResultList();

        Map<String, LoyaltyAnalyticsResponse.PointTransactionSummary> pointTransactions = new LinkedHashMap<>();
        for (Object[] row : pointRows) {
            String type = row[0] != null ? row[0].toString() : "UNKNOWN";
            pointTransactions.put(type, LoyaltyAnalyticsResponse.PointTransactionSummary.builder()
                    .transactionCount(asLong(row[1]))
                    .points(asInteger(row[2]))
                    .build());
        }

        List<LoyaltyAnalyticsResponse.TierSummary> byTier = tierBuckets.entrySet().stream()
                .map(entry -> entry.getValue().toResponse(entry.getKey()))
                .toList();

        return LoyaltyAnalyticsResponse.builder()
                .from(range.from())
                .to(range.to())
                .garageId(garageId)
                .totalMembers((long) loyalties.size())
                .totalAvailablePoints(totalAvailablePoints)
                .totalRedeemedPoints(totalRedeemedPoints)
                .totalExpiredPoints(totalExpiredPoints)
                .totalSpent(totalSpent)
                .totalVisits(totalVisits)
                .pointTransactionsByType(pointTransactions)
                .byTier(byTier)
                .build();
    }

    @Override
    public PromotionAnalyticsResponse getPromotionPerformance(AnalyticsFilterRequest filter) {
        AnalyticsRange range = validateRange(filter);
        Long garageId = filter.getGarageId();
        List<Object[]> rows = bindRangeAndGarage(entityManager.createQuery("""
                SELECT p.id, p.code, p.name, COUNT(u), COALESCE(SUM(u.discountAmount), 0)
                FROM PromotionUsage u
                JOIN Booking b ON b.id = u.bookingId
                JOIN Promotion p ON p.id = u.promotionId
                WHERE b.status = 'COMPLETED'
                  AND b.paymentStatus = 'PAID'
                  AND b.paidAt >= :start
                  AND b.paidAt < :end
                  AND (:garageId IS NULL OR b.garageId = :garageId)
                GROUP BY p.id, p.code, p.name
                ORDER BY COALESCE(SUM(u.discountAmount), 0) DESC
                """, Object[].class), range, garageId).getResultList();

        long totalUsages = 0L;
        BigDecimal totalDiscountAmount = BigDecimal.ZERO;
        List<PromotionAnalyticsResponse.PromotionPerformance> promotions = new ArrayList<>();

        for (Object[] row : rows) {
            long usageCount = asLong(row[3]);
            BigDecimal discountAmount = asBigDecimal(row[4]);
            totalUsages += usageCount;
            totalDiscountAmount = totalDiscountAmount.add(discountAmount);
            promotions.add(PromotionAnalyticsResponse.PromotionPerformance.builder()
                    .promotionId((Long) row[0])
                    .code((String) row[1])
                    .name((String) row[2])
                    .usageCount(usageCount)
                    .discountAmount(discountAmount)
                    .build());
        }

        return PromotionAnalyticsResponse.builder()
                .from(range.from())
                .to(range.to())
                .garageId(garageId)
                .totalUsages(totalUsages)
                .totalDiscountAmount(totalDiscountAmount)
                .promotions(promotions)
                .build();
    }

    @Override
    public WashBayAnalyticsResponse getWashBayPerformance(AnalyticsFilterRequest filter) {
        AnalyticsRange range = validateRange(filter);
        Long garageId = filter.getGarageId();
        List<Object[]> rows = bindRangeAndGarage(entityManager.createQuery("""
                SELECT w.id, w.bayCode, w.garageId, w.vehicleType, b.washBayStartTime, b.washBayEndTime
                FROM Booking b
                JOIN WashBay w ON w.id = b.washBayId
                WHERE b.status = 'COMPLETED'
                  AND b.washBayId IS NOT NULL
                  AND b.washBayStartTime IS NOT NULL
                  AND b.washBayEndTime IS NOT NULL
                  AND b.washBayStartTime >= :start
                  AND b.washBayStartTime < :end
                  AND (:garageId IS NULL OR b.garageId = :garageId)
                """, Object[].class), range, garageId).getResultList();

        Map<Long, WashBayBucket> buckets = new LinkedHashMap<>();
        for (Object[] row : rows) {
            Long washBayId = (Long) row[0];
            WashBayBucket bucket = buckets.computeIfAbsent(washBayId, id -> new WashBayBucket(
                    washBayId,
                    (String) row[1],
                    (Long) row[2],
                    (String) row[3]));
            bucket.add((LocalDateTime) row[4], (LocalDateTime) row[5]);
        }

        List<WashBayAnalyticsResponse.WashBayPerformance> washBays = buckets.values().stream()
                .sorted(Comparator.comparingLong(WashBayBucket::usageMinutes).reversed())
                .map(WashBayBucket::toResponse)
                .toList();

        long totalUsages = buckets.values().stream().mapToLong(WashBayBucket::usageCount).sum();
        long totalUsageMinutes = buckets.values().stream().mapToLong(WashBayBucket::usageMinutes).sum();

        return WashBayAnalyticsResponse.builder()
                .from(range.from())
                .to(range.to())
                .garageId(garageId)
                .totalUsages(totalUsages)
                .totalUsageMinutes(totalUsageMinutes)
                .averageUsageMinutes(totalUsages == 0L ? 0D : (double) totalUsageMinutes / totalUsages)
                .washBays(washBays)
                .build();
    }

    private List<CustomerLoyalty> loadLoyalties(AnalyticsRange range, Long garageId) {
        if (garageId == null) {
            return entityManager.createQuery("""
                    SELECT c
                    FROM CustomerLoyalty c
                    ORDER BY c.currentTier
                    """, CustomerLoyalty.class).getResultList();
        }

        return bindRangeAndGarage(entityManager.createQuery("""
                SELECT c
                FROM CustomerLoyalty c
                WHERE EXISTS (
                    SELECT 1
                    FROM Booking b
                    WHERE b.customerId = c.customerId
                      AND b.status = 'COMPLETED'
                      AND b.paymentStatus = 'PAID'
                      AND b.paidAt >= :start
                      AND b.paidAt < :end
                      AND b.garageId = :garageId
                )
                ORDER BY c.currentTier
                """, CustomerLoyalty.class), range, garageId).getResultList();
    }

    private AnalyticsRange validateRange(AnalyticsFilterRequest filter) {
        if (filter == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "analytics filter is required");
        }
        LocalDate from = filter.getFrom();
        LocalDate to = filter.getTo();
        if (from == null || to == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from and to are required");
        }
        if (from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from must be before or equal to to");
        }
        return new AnalyticsRange(from, to, from.atStartOfDay(), to.plusDays(1).atStartOfDay());
    }

    private <T> TypedQuery<T> bindRangeAndGarage(TypedQuery<T> query, AnalyticsRange range, Long garageId) {
        return query
                .setParameter("start", range.start())
                .setParameter("end", range.end())
                .setParameter("garageId", garageId);
    }

    private long asLong(Object value) {
        if (value == null) {
            return 0L;
        }
        return ((Number) value).longValue();
    }

    private int asInteger(Object value) {
        if (value == null) {
            return 0;
        }
        return ((Number) value).intValue();
    }

    private BigDecimal asBigDecimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal bigDecimal) {
            return bigDecimal;
        }
        return BigDecimal.valueOf(((Number) value).doubleValue());
    }

    private int valueOrZero(Integer value) {
        return value != null ? value : 0;
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private BigDecimal average(BigDecimal total, long count) {
        if (count == 0L) {
            return BigDecimal.ZERO;
        }
        return total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
    }

    private List<RevenueAnalyticsResponse.DateRevenue> toDateRevenue(Map<LocalDate, RevenueBucket> buckets) {
        return buckets.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> RevenueAnalyticsResponse.DateRevenue.builder()
                        .date(entry.getKey())
                        .paidBookingCount(entry.getValue().count())
                        .revenue(entry.getValue().amount())
                        .build())
                .toList();
    }

    private List<RevenueAnalyticsResponse.GarageRevenue> toGarageRevenue(Map<Long, RevenueBucket> buckets) {
        return buckets.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> RevenueAnalyticsResponse.GarageRevenue.builder()
                        .garageId(entry.getKey())
                        .paidBookingCount(entry.getValue().count())
                        .revenue(entry.getValue().amount())
                        .build())
                .toList();
    }

    private List<RevenueAnalyticsResponse.PaymentMethodRevenue> toPaymentMethodRevenue(Map<String, RevenueBucket> buckets) {
        return buckets.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> RevenueAnalyticsResponse.PaymentMethodRevenue.builder()
                        .paymentMethod(entry.getKey())
                        .paidBookingCount(entry.getValue().count())
                        .revenue(entry.getValue().amount())
                        .build())
                .toList();
    }

    private record AnalyticsRange(LocalDate from, LocalDate to, LocalDateTime start, LocalDateTime end) {
    }

    private static class RevenueBucket {
        private long count;
        private BigDecimal amount = BigDecimal.ZERO;

        private void add(BigDecimal value) {
            count++;
            amount = amount.add(value);
        }

        private long count() {
            return count;
        }

        private BigDecimal amount() {
            return amount;
        }
    }

    private static class LoyaltyBucket {
        private long count;
        private int availablePoints;
        private int redeemedPoints;
        private BigDecimal totalSpent = BigDecimal.ZERO;
        private int totalVisits;

        private void add(CustomerLoyalty loyalty) {
            count++;
            availablePoints += loyalty.getAvailablePoints() != null ? loyalty.getAvailablePoints() : 0;
            redeemedPoints += loyalty.getRedeemedPoints() != null ? loyalty.getRedeemedPoints() : 0;
            totalSpent = totalSpent.add(loyalty.getTotalSpent() != null ? loyalty.getTotalSpent() : BigDecimal.ZERO);
            totalVisits += loyalty.getTotalVisits() != null ? loyalty.getTotalVisits() : 0;
        }

        private LoyaltyAnalyticsResponse.TierSummary toResponse(String tier) {
            return LoyaltyAnalyticsResponse.TierSummary.builder()
                    .tier(tier)
                    .memberCount(count)
                    .availablePoints(availablePoints)
                    .redeemedPoints(redeemedPoints)
                    .totalSpent(totalSpent)
                    .totalVisits(totalVisits)
                    .build();
        }
    }

    private static class WashBayBucket {
        private final Long washBayId;
        private final String bayCode;
        private final Long garageId;
        private final String vehicleType;
        private long usageCount;
        private long usageMinutes;

        private WashBayBucket(Long washBayId, String bayCode, Long garageId, String vehicleType) {
            this.washBayId = washBayId;
            this.bayCode = bayCode;
            this.garageId = garageId;
            this.vehicleType = vehicleType;
        }

        private void add(LocalDateTime start, LocalDateTime end) {
            long minutes = Math.max(0L, Duration.between(start, end).toMinutes());
            usageCount++;
            usageMinutes += minutes;
        }

        private long usageCount() {
            return usageCount;
        }

        private long usageMinutes() {
            return usageMinutes;
        }

        private WashBayAnalyticsResponse.WashBayPerformance toResponse() {
            return WashBayAnalyticsResponse.WashBayPerformance.builder()
                    .washBayId(washBayId)
                    .bayCode(bayCode)
                    .garageId(garageId)
                    .vehicleType(vehicleType)
                    .usageCount(usageCount)
                    .usageMinutes(usageMinutes)
                    .averageUsageMinutes(usageCount == 0L ? 0D : (double) usageMinutes / usageCount)
                    .build();
        }
    }
}
