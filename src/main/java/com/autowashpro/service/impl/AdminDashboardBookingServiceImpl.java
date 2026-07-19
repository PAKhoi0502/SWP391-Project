package com.autowashpro.service.impl;

import com.autowashpro.dto.analytics.AdminDashboardBookingRowResponse;
import com.autowashpro.dto.analytics.BookingCalendarDayResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.service.AdminDashboardBookingService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminDashboardBookingServiceImpl implements AdminDashboardBookingService {

    private final EntityManager entityManager;

    // Status sets for tab filtering
    private static final Set<String> STATUSES_CONFIRMED   = Set.of("CONFIRMED");
    private static final Set<String> STATUSES_IN_PROGRESS = Set.of("CHECKED_IN", "IN_PROGRESS");
    private static final Set<String> STATUSES_CANCELED    = Set.of("CANCELED", "CANCELLED", "NO_SHOW");

    @Override
    public PageResponse<AdminDashboardBookingRowResponse> getBookingManagement(
            int page,
            int limit,
            String tab,
            Long garageId,
            Long servicePackageId,
            String status,
            String date
    ) {
        // Resolve tab status set
        Set<String> tabStatuses = resolveTabStatuses(tab);

        // Determine effective status filter:
        // If a status param is given and it belongs to the tab's allowed statuses, filter by it.
        // Otherwise ignore the status param (it may not belong to this tab).
        String effectiveStatus = null;
        if (status != null && !status.isBlank()) {
            if (tabStatuses == null || tabStatuses.contains(status)) {
                effectiveStatus = status;
            }
        }

        // Parse date
        LocalDate filterDate = null;
        if (date != null && !date.isBlank()) {
            try {
                filterDate = LocalDate.parse(date);
            } catch (Exception ignored) {
                // Invalid date — ignore filter
            }
        }

        // Build dynamic WHERE clause
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        if (tabStatuses != null && effectiveStatus == null) {
            where.append(" AND b.status IN :tabStatuses");
        }
        if (effectiveStatus != null) {
            where.append(" AND b.status = :status");
        }
        if (garageId != null) {
            where.append(" AND b.garage_id = :garageId");
        }
        if (servicePackageId != null) {
            where.append(" AND b.service_package_id = :servicePackageId");
        }
        if (filterDate != null) {
            where.append(" AND CAST(b.start_time AS DATE) = :filterDate");
        }

        // Count query
        String countSql = "SELECT COUNT(*) FROM bookings b" + where;
        Query countQuery = entityManager.createNativeQuery(countSql);
        setParams(countQuery, tabStatuses, effectiveStatus, garageId, servicePackageId, filterDate);
        long totalItems = ((Number) countQuery.getSingleResult()).longValue();

        if (totalItems == 0) {
            return PageResponse.<AdminDashboardBookingRowResponse>builder()
                    .data(Collections.emptyList())
                    .page(page)
                    .limit(limit)
                    .totalItems(0L)
                    .totalPages(0)
                    .build();
        }

        // Data query — LEFT JOINs with users, garages, service_packages
        String dataSql = """
                SELECT
                    b.id                 AS booking_id,
                    b.customer_id,
                    b.is_walk_in,
                    b.guest_name,
                    u.full_name          AS user_full_name,
                    b.garage_id,
                    g.name               AS garage_name,
                    b.service_package_id,
                    sp.name              AS service_package_name,
                    b.start_time,
                    b.payment_status,
                    b.payment_method,
                    b.final_price,
                    b.status
                FROM bookings b
                LEFT JOIN users u ON u.id = b.customer_id
                LEFT JOIN garages g ON g.id = b.garage_id
                LEFT JOIN service_packages sp ON sp.id = b.service_package_id
                """ + where + " ORDER BY b.start_time DESC, b.id DESC";

        Query dataQuery = entityManager.createNativeQuery(dataSql);
        setParams(dataQuery, tabStatuses, effectiveStatus, garageId, servicePackageId, filterDate);
        dataQuery.setFirstResult((page - 1) * limit);
        dataQuery.setMaxResults(limit);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = dataQuery.getResultList();
        List<AdminDashboardBookingRowResponse> data = new ArrayList<>(rows.size());

        for (Object[] row : rows) {
            long   bookingId         = toLong(row[0]);
            Long   customerId        = row[1] != null ? toLong(row[1]) : null;
            boolean walkIn           = toBoolean(row[2]);
            String guestName         = (String) row[3];
            String userFullName      = (String) row[4];
            Long   bGarageId         = row[5] != null ? toLong(row[5]) : null;
            String garageName        = (String) row[6];
            Long   bServicePackageId = row[7] != null ? toLong(row[7]) : null;
            String servicePackageName = (String) row[8];
            LocalDateTime startTime  = toLocalDateTime(row[9]);
            String paymentStatus     = (String) row[10];
            String paymentMethod     = (String) row[11];
            BigDecimal finalPrice    = row[12] != null ? new BigDecimal(row[12].toString()) : null;
            String bStatus           = (String) row[13];

            // Customer name: walk-in uses guestName, registered uses user.fullName
            String customerName = (walkIn && guestName != null && !guestName.isBlank())
                    ? guestName
                    : userFullName;

            data.add(AdminDashboardBookingRowResponse.builder()
                    .bookingId(bookingId)
                    .customerId(customerId)
                    .customerName(customerName)
                    .isWalkIn(walkIn)
                    .garageId(bGarageId)
                    .garageName(garageName)
                    .servicePackageId(bServicePackageId)
                    .servicePackageName(servicePackageName)
                    .startTime(startTime)
                    .paymentStatus(paymentStatus)
                    .paymentMethod(paymentMethod)
                    .finalPrice(finalPrice)
                    .status(bStatus)
                    .build());
        }

        int totalPages = (int) Math.ceil((double) totalItems / limit);
        return PageResponse.<AdminDashboardBookingRowResponse>builder()
                .data(data)
                .page(page)
                .limit(limit)
                .totalItems(totalItems)
                .totalPages(totalPages)
                .build();
    }

    @Override
    public List<BookingCalendarDayResponse> getBookingCalendar(
            int year, int month, Long garageId, Long servicePackageId) {

        StringBuilder sql = new StringBuilder("""
                SELECT
                    CONVERT(varchar(10), CAST(b.start_time AS DATE), 120) AS booking_date,
                    b.status,
                    COUNT(*) AS cnt
                FROM bookings b
                WHERE YEAR(b.start_time) = :year
                  AND MONTH(b.start_time) = :month
                """);

        if (garageId != null) {
            sql.append("  AND b.garage_id = :garageId\n");
        }
        if (servicePackageId != null) {
            sql.append("  AND b.service_package_id = :servicePackageId\n");
        }
        sql.append(" GROUP BY CAST(b.start_time AS DATE), b.status");
        sql.append(" ORDER BY CAST(b.start_time AS DATE)");

        Query query = entityManager.createNativeQuery(sql.toString());
        query.setParameter("year", year);
        query.setParameter("month", month);
        if (garageId != null) {
            query.setParameter("garageId", garageId);
        }
        if (servicePackageId != null) {
            query.setParameter("servicePackageId", servicePackageId);
        }

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();

        // Group rows by date
        LinkedHashMap<String, Map<String, Integer>> grouped = new LinkedHashMap<>();
        for (Object[] row : rows) {
            String dateStr = (String) row[0];
            String status  = (String) row[1];
            int    count   = ((Number) row[2]).intValue();
            grouped.computeIfAbsent(dateStr, k -> new HashMap<>()).put(status, count);
        }

        List<BookingCalendarDayResponse> result = new ArrayList<>(grouped.size());
        for (Map.Entry<String, Map<String, Integer>> entry : grouped.entrySet()) {
            int total = entry.getValue().values().stream().mapToInt(Integer::intValue).sum();
            result.add(BookingCalendarDayResponse.builder()
                    .date(entry.getKey())
                    .totalBookings(total)
                    .byStatus(entry.getValue())
                    .build());
        }
        return result;
    }

    /* ── Helpers ─────────────────────────────────────────────────── */

    private Set<String> resolveTabStatuses(String tab) {
        if (tab == null) return null;
        return switch (tab.toUpperCase()) {
            case "CONFIRMED"   -> STATUSES_CONFIRMED;
            case "IN_PROGRESS" -> STATUSES_IN_PROGRESS;
            case "CANCELED"    -> STATUSES_CANCELED;
            default            -> null;  // ALL — no tab status filter
        };
    }

    private void setParams(Query q, Set<String> tabStatuses, String effectiveStatus,
                           Long garageId, Long servicePackageId, LocalDate filterDate) {
        if (tabStatuses != null && effectiveStatus == null) {
            q.setParameter("tabStatuses", tabStatuses);
        }
        if (effectiveStatus != null) {
            q.setParameter("status", effectiveStatus);
        }
        if (garageId != null) {
            q.setParameter("garageId", garageId);
        }
        if (servicePackageId != null) {
            q.setParameter("servicePackageId", servicePackageId);
        }
        if (filterDate != null) {
            q.setParameter("filterDate", filterDate);
        }
    }

    private long toLong(Object val) {
        if (val instanceof Number n) return n.longValue();
        return Long.parseLong(val.toString());
    }

    private boolean toBoolean(Object val) {
        if (val == null) return false;
        if (val instanceof Boolean b) return b;
        if (val instanceof Number n) return n.intValue() != 0;
        return Boolean.parseBoolean(val.toString());
    }

    private LocalDateTime toLocalDateTime(Object val) {
        if (val == null) return null;
        if (val instanceof LocalDateTime ldt) return ldt;
        // JDBC may return java.sql.Timestamp
        if (val instanceof java.sql.Timestamp ts) return ts.toLocalDateTime();
        return null;
    }
}
