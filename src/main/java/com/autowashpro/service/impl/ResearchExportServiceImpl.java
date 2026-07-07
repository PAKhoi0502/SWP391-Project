package com.autowashpro.service.impl;

import com.autowashpro.common.ResearchExportFormat;
import com.autowashpro.dto.request.ResearchExportFilterRequest;
import com.autowashpro.dto.response.ResearchBookingExportRow;
import com.autowashpro.dto.response.ResearchCustomerExportRow;
import com.autowashpro.dto.response.ResearchExportFile;
import com.autowashpro.service.ResearchExportService;
import com.autowashpro.service.support.ResearchAnonymizer;
import com.autowashpro.service.support.ResearchExportWriter;
import jakarta.persistence.EntityManager;
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
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ResearchExportServiceImpl implements ResearchExportService {

    private static final long MAX_EXPORT_DAYS = 366L;

    private final EntityManager entityManager;
    private final ResearchAnonymizer anonymizer;
    private final ResearchExportWriter exportWriter;

    @Override
    public ResearchExportFile exportBookings(ResearchExportFilterRequest filter) {
        ExportContext context = validate(filter);
        List<BookingResearchRecord> records = loadBookingRecords(context.range());
        Set<Long> promotionBookingIds = loadPromotionBookingIds(context.range());
        List<ResearchBookingExportRow> rows = records.stream()
                .map(record -> toBookingRow(record, promotionBookingIds.contains(record.bookingId())))
                .toList();

        return file(
                "research-bookings",
                context,
                exportWriter.write(rows, ResearchBookingExportRow.class, context.format()));
    }

    @Override
    public ResearchExportFile exportCustomers(ResearchExportFilterRequest filter) {
        ExportContext context = validate(filter);
        List<BookingResearchRecord> records = loadBookingRecords(context.range());
        Set<Long> promotionBookingIds = loadPromotionBookingIds(context.range());
        Map<String, CustomerAccumulator> customers = new LinkedHashMap<>();

        for (BookingResearchRecord record : records) {
            String customerAnonymousId = anonymizer.anonymizeCustomer(
                    record.customerId(), record.guestPhone(), record.bookingId());
            CustomerAccumulator accumulator = customers.computeIfAbsent(
                    customerAnonymousId,
                    key -> new CustomerAccumulator(
                            customerAnonymousId,
                            customerType(record),
                            loyaltyTier(record)));
            accumulator.add(record, promotionBookingIds.contains(record.bookingId()));
        }

        List<ResearchCustomerExportRow> rows = customers.values().stream()
                .sorted(Comparator.comparing(CustomerAccumulator::customerAnonymousId))
                .map(CustomerAccumulator::toResponse)
                .toList();

        return file(
                "research-customers",
                context,
                exportWriter.write(rows, ResearchCustomerExportRow.class, context.format()));
    }

    private List<BookingResearchRecord> loadBookingRecords(DateRange range) {
        List<Object[]> rows = entityManager.createQuery("""
                SELECT b.id, b.customerId, b.guestPhone, b.startTime, b.endTime,
                       b.status, b.paymentStatus, b.paymentMethod, b.finalPrice,
                       b.discountAmount, b.usedPoints, b.isWalkIn, b.washBayId,
                       v.vehicleType, v.engineType, g.city, s.serviceType, l.currentTier
                FROM Booking b
                LEFT JOIN Vehicle v ON v.id = b.vehicleId
                LEFT JOIN Garage g ON g.id = b.garageId
                LEFT JOIN ServicePackage s ON s.id = b.servicePackageId
                LEFT JOIN CustomerLoyalty l ON l.customerId = b.customerId
                WHERE b.startTime >= :start
                  AND b.startTime < :end
                ORDER BY b.startTime, b.id
                """, Object[].class)
                .setParameter("start", range.start())
                .setParameter("end", range.end())
                .getResultList();

        return rows.stream().map(this::toRecord).toList();
    }

    private Set<Long> loadPromotionBookingIds(DateRange range) {
        return new HashSet<>(entityManager.createQuery("""
                SELECT DISTINCT u.bookingId
                FROM PromotionUsage u
                JOIN Booking b ON b.id = u.bookingId
                WHERE b.startTime >= :start
                  AND b.startTime < :end
                """, Long.class)
                .setParameter("start", range.start())
                .setParameter("end", range.end())
                .getResultList());
    }

    private BookingResearchRecord toRecord(Object[] row) {
        return new BookingResearchRecord(
                (Long) row[0],
                (Long) row[1],
                (String) row[2],
                (LocalDateTime) row[3],
                (LocalDateTime) row[4],
                (String) row[5],
                (String) row[6],
                (String) row[7],
                valueOrZero((BigDecimal) row[8]),
                valueOrZero((BigDecimal) row[9]),
                valueOrZero((Integer) row[10]),
                Boolean.TRUE.equals(row[11]),
                (Long) row[12],
                safeText((String) row[13], "UNKNOWN"),
                safeText((String) row[14], "UNKNOWN"),
                safeText((String) row[15], "UNKNOWN"),
                safeText((String) row[16], "UNKNOWN"),
                safeText((String) row[17], "NONE"));
    }

    private ResearchBookingExportRow toBookingRow(BookingResearchRecord record, boolean promotionUsed) {
        return ResearchBookingExportRow.builder()
                .bookingAnonymousId(anonymizer.anonymizeBooking(record.bookingId()))
                .customerAnonymousId(anonymizer.anonymizeCustomer(
                        record.customerId(), record.guestPhone(), record.bookingId()))
                .customerType(customerType(record))
                .vehicleType(record.vehicleType())
                .engineType(record.engineType())
                .garageArea(record.garageArea())
                .serviceType(record.serviceType())
                .bookingMonth(YearMonth.from(record.startTime()).toString())
                .dayOfWeek(record.startTime().getDayOfWeek().name())
                .timeBucket(timeBucket(record.startTime()))
                .scheduledDurationMinutes(durationMinutes(record.startTime(), record.endTime()))
                .bookingStatus(safeText(record.status(), "UNKNOWN"))
                .paymentStatus(safeText(record.paymentStatus(), "UNKNOWN"))
                .paymentMethod(safeText(record.paymentMethod(), "NONE"))
                .finalPrice(record.finalPrice())
                .discountAmount(record.discountAmount())
                .usedPoints(record.usedPoints())
                .loyaltyTier(loyaltyTier(record))
                .isWalkIn(record.isWalkIn() || record.customerId() == null)
                .promotionUsed(promotionUsed)
                .washBayUsed(record.washBayId() != null)
                .build();
    }

    private ExportContext validate(ResearchExportFilterRequest filter) {
        if (filter == null || filter.getFrom() == null || filter.getTo() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from and to are required");
        }
        if (filter.getFrom().isAfter(filter.getTo())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from must be before or equal to to");
        }
        long inclusiveDays = ChronoUnit.DAYS.between(filter.getFrom(), filter.getTo()) + 1L;
        if (inclusiveDays > MAX_EXPORT_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date range cannot exceed 366 days");
        }
        ResearchExportFormat format = ResearchExportFormat.from(filter.getFormat());
        return new ExportContext(
                new DateRange(
                        filter.getFrom(),
                        filter.getTo(),
                        filter.getFrom().atStartOfDay(),
                        filter.getTo().plusDays(1).atStartOfDay()),
                format);
    }

    private ResearchExportFile file(String prefix, ExportContext context, byte[] content) {
        String filename = "%s-%s-to-%s.%s".formatted(
                prefix,
                context.range().from(),
                context.range().to(),
                context.format().extension());
        return new ResearchExportFile(filename, context.format().contentType(), content);
    }

    private String customerType(BookingResearchRecord record) {
        return record.customerId() != null ? "REGISTERED" : "WALK_IN";
    }

    private String loyaltyTier(BookingResearchRecord record) {
        return record.customerId() != null ? record.loyaltyTier() : "NONE";
    }

    private static String timeBucket(LocalDateTime time) {
        int hour = time.getHour();
        if (hour < 6) {
            return "NIGHT";
        }
        if (hour < 12) {
            return "MORNING";
        }
        if (hour < 18) {
            return "AFTERNOON";
        }
        return "EVENING";
    }

    private long durationMinutes(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null) {
            return 0L;
        }
        return Math.max(0L, Duration.between(start, end).toMinutes());
    }

    private String safeText(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        String normalized = value.strip().replaceAll("[\\r\\n\\t]", " ");
        if (!normalized.isEmpty() && "=+-@".indexOf(normalized.charAt(0)) >= 0) {
            return "'" + normalized;
        }
        return normalized;
    }

    private BigDecimal valueOrZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private int valueOrZero(Integer value) {
        return value != null ? value : 0;
    }

    private record DateRange(LocalDate from, LocalDate to, LocalDateTime start, LocalDateTime end) {
    }

    private record ExportContext(DateRange range, ResearchExportFormat format) {
    }

    private record BookingResearchRecord(
            Long bookingId,
            Long customerId,
            String guestPhone,
            LocalDateTime startTime,
            LocalDateTime endTime,
            String status,
            String paymentStatus,
            String paymentMethod,
            BigDecimal finalPrice,
            BigDecimal discountAmount,
            Integer usedPoints,
            boolean isWalkIn,
            Long washBayId,
            String vehicleType,
            String engineType,
            String garageArea,
            String serviceType,
            String loyaltyTier) {
    }

    private static class CustomerAccumulator {
        private final String customerAnonymousId;
        private final String customerType;
        private String loyaltyTier;
        private long totalBookings;
        private long completedBookings;
        private long canceledBookings;
        private long noShowBookings;
        private long paidBookings;
        private BigDecimal totalSpent = BigDecimal.ZERO;
        private long promotionUsageCount;
        private int pointsRedeemed;
        private final Map<String, Long> vehicleTypes = new LinkedHashMap<>();
        private final Map<String, Long> timeBuckets = new LinkedHashMap<>();
        private final Set<YearMonth> activeMonths = new LinkedHashSet<>();
        private final Set<String> garageAreas = new LinkedHashSet<>();

        private CustomerAccumulator(String customerAnonymousId, String customerType, String loyaltyTier) {
            this.customerAnonymousId = customerAnonymousId;
            this.customerType = customerType;
            this.loyaltyTier = loyaltyTier;
        }

        private String customerAnonymousId() {
            return customerAnonymousId;
        }

        private void add(BookingResearchRecord record, boolean promotionUsed) {
            totalBookings++;
            if ("COMPLETED".equals(record.status())) {
                completedBookings++;
            } else if ("CANCELED".equals(record.status())) {
                canceledBookings++;
            } else if ("NO_SHOW".equals(record.status())) {
                noShowBookings++;
            }
            if ("COMPLETED".equals(record.status()) && "PAID".equals(record.paymentStatus())) {
                paidBookings++;
                totalSpent = totalSpent.add(record.finalPrice());
            }
            if (promotionUsed) {
                promotionUsageCount++;
            }
            pointsRedeemed += Math.max(0, record.usedPoints());
            vehicleTypes.merge(record.vehicleType(), 1L, Long::sum);
            timeBuckets.merge(timeBucket(record.startTime()), 1L, Long::sum);
            activeMonths.add(YearMonth.from(record.startTime()));
            garageAreas.add(record.garageArea());
            if (!"NONE".equals(record.loyaltyTier())) {
                loyaltyTier = record.loyaltyTier();
            }
        }

        private ResearchCustomerExportRow toResponse() {
            return ResearchCustomerExportRow.builder()
                    .customerAnonymousId(customerAnonymousId)
                    .customerType(customerType)
                    .loyaltyTier(loyaltyTier)
                    .totalBookings(totalBookings)
                    .completedBookings(completedBookings)
                    .canceledBookings(canceledBookings)
                    .noShowBookings(noShowBookings)
                    .paidBookings(paidBookings)
                    .totalSpent(totalSpent)
                    .averageSpent(paidBookings == 0L
                            ? BigDecimal.ZERO
                            : totalSpent.divide(BigDecimal.valueOf(paidBookings), 2, RoundingMode.HALF_UP))
                    .promotionUsageCount(promotionUsageCount)
                    .pointsRedeemed(pointsRedeemed)
                    .primaryVehicleType(mostFrequent(vehicleTypes))
                    .preferredTimeBucket(mostFrequent(timeBuckets))
                    .activeMonths(activeMonths.size())
                    .distinctGarageAreas(garageAreas.size())
                    .build();
        }

        private static String mostFrequent(Map<String, Long> values) {
            return values.entrySet().stream()
                    .sorted(Comparator.<Map.Entry<String, Long>>comparingLong(Map.Entry::getValue)
                            .reversed()
                            .thenComparing(Map.Entry::getKey))
                    .map(Map.Entry::getKey)
                    .findFirst()
                    .orElse("UNKNOWN");
        }
    }
}
