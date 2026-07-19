package com.autowashpro.service.impl;

import com.autowashpro.dto.analytics.AdminDashboardBookingRowResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.User;
import com.autowashpro.service.AdminDashboardBookingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@Import(AdminDashboardBookingServiceImpl.class)
@ActiveProfiles("test")
class AdminDashboardBookingServiceImplTest {

    private static final LocalDateTime BASE_TIME = LocalDateTime.of(2026, 7, 10, 9, 0);

    @Autowired
    private AdminDashboardBookingService service;

    @Autowired
    private TestEntityManager em;

    // IDs set after persist
    private Long garageId;
    private Long servicePackageId;
    private Long customerId;

    @BeforeEach
    void setUp() {
        Garage garage = new Garage();
        garage.setName("Test Garage");
        garage.setGarageCode("TG-01");
        garage.setAddress("1 Test St");
        garage.setCity("HCMC");
        garage.setPhone("0287000001");
        garage.setOpeningTime(LocalTime.of(7, 0));
        garage.setClosingTime(LocalTime.of(21, 0));
        garage.setSlotIntervalMinutes(30);
        garage.setIsActive(true);
        garageId = em.persistAndFlush(garage).getId();

        ServicePackage sp = new ServicePackage();
        sp.setName("Basic Wash");
        sp.setCode("BW-01");
        sp.setVehicleType("CAR");
        sp.setServiceType("WASH");
        sp.setBasePrice(new BigDecimal("150000"));
        sp.setDurationMinutes(30);
        sp.setWashBayDurationMinutes(20);
        sp.setPointsEarned(10);
        sp.setRequiresWashBay(true);
        sp.setRequiresCareStaff(false);
        servicePackageId = em.persistAndFlush(sp).getId();

        User user = User.builder()
                .fullName("Nguyen Van A")
                .email("customer@test.local")
                .phone("0901000001")
                .passwordHash("hash")
                .role("CUSTOMER")
                .authProvider("LOCAL")
                .isActive(true)
                .build();
        customerId = em.persistAndFlush(user).getId();
    }

    // ── 1. Pagination returns correct page/limit/totalItems ──────────

    @Test
    void paginationReturnsCorrectMetadata() {
        for (int i = 0; i < 10; i++) {
            persistBooking("CONFIRMED", customerId, false, null, BASE_TIME.plusMinutes(i * 30));
        }

        PageResponse<AdminDashboardBookingRowResponse> page1 =
                service.getBookingManagement(1, 4, "ALL", null, null, null, null);

        assertEquals(1, page1.getPage());
        assertEquals(4, page1.getLimit());
        assertEquals(10L, page1.getTotalItems());
        assertEquals(3, page1.getTotalPages());
        assertEquals(4, page1.getData().size());

        PageResponse<AdminDashboardBookingRowResponse> page3 =
                service.getBookingManagement(3, 4, "ALL", null, null, null, null);
        assertEquals(2, page3.getData().size());
    }

    // ── 2. Tab CONFIRMED filters correctly ──────────────────────────

    @Test
    void tabConfirmedFiltersToConfirmedOnly() {
        persistBooking("CONFIRMED",   customerId, false, null, BASE_TIME);
        persistBooking("CHECKED_IN",  customerId, false, null, BASE_TIME.plusHours(1));
        persistBooking("IN_PROGRESS", customerId, false, null, BASE_TIME.plusHours(2));
        persistBooking("COMPLETED",   customerId, false, null, BASE_TIME.plusHours(3));

        PageResponse<AdminDashboardBookingRowResponse> result =
                service.getBookingManagement(1, 10, "CONFIRMED", null, null, null, null);

        assertEquals(1L, result.getTotalItems());
        assertEquals("CONFIRMED", result.getData().get(0).getStatus());
    }

    // ── 3. Tab IN_PROGRESS includes CHECKED_IN and IN_PROGRESS ──────

    @Test
    void tabInProgressIncludesCheckedInAndInProgress() {
        persistBooking("CONFIRMED",   customerId, false, null, BASE_TIME);
        persistBooking("CHECKED_IN",  customerId, false, null, BASE_TIME.plusHours(1));
        persistBooking("IN_PROGRESS", customerId, false, null, BASE_TIME.plusHours(2));
        persistBooking("COMPLETED",   customerId, false, null, BASE_TIME.plusHours(3));

        PageResponse<AdminDashboardBookingRowResponse> result =
                service.getBookingManagement(1, 10, "IN_PROGRESS", null, null, null, null);

        assertEquals(2L, result.getTotalItems());
        List<String> statuses = result.getData().stream()
                .map(AdminDashboardBookingRowResponse::getStatus).toList();
        assertTrue(statuses.contains("CHECKED_IN"));
        assertTrue(statuses.contains("IN_PROGRESS"));
    }

    // ── 4. Tab CANCELED includes CANCELED, CANCELLED, NO_SHOW ───────

    @Test
    void tabCanceledIncludesCanceledCancelledAndNoShow() {
        persistBooking("CONFIRMED", customerId, false, null, BASE_TIME);
        persistBooking("CANCELED",  customerId, false, null, BASE_TIME.plusHours(1));
        persistBooking("CANCELLED", customerId, false, null, BASE_TIME.plusHours(2));
        persistBooking("NO_SHOW",   customerId, false, null, BASE_TIME.plusHours(3));
        persistBooking("COMPLETED", customerId, false, null, BASE_TIME.plusHours(4));

        PageResponse<AdminDashboardBookingRowResponse> result =
                service.getBookingManagement(1, 10, "CANCELED", null, null, null, null);

        assertEquals(3L, result.getTotalItems());
        List<String> statuses = result.getData().stream()
                .map(AdminDashboardBookingRowResponse::getStatus).toList();
        assertTrue(statuses.contains("CANCELED"));
        assertTrue(statuses.contains("CANCELLED"));
        assertTrue(statuses.contains("NO_SHOW"));
        assertFalse(statuses.contains("CONFIRMED"));
        assertFalse(statuses.contains("COMPLETED"));
    }

    // ── 5. Date filter works ─────────────────────────────────────────

    @Test
    void dateFilterReturnsOnlyBookingsOnThatDate() {
        LocalDateTime day1 = LocalDateTime.of(2026, 7, 10, 9, 0);
        LocalDateTime day2 = LocalDateTime.of(2026, 7, 11, 9, 0);

        persistBooking("CONFIRMED", customerId, false, null, day1);
        persistBooking("CONFIRMED", customerId, false, null, day1.plusHours(2));
        persistBooking("CONFIRMED", customerId, false, null, day2);

        PageResponse<AdminDashboardBookingRowResponse> result =
                service.getBookingManagement(1, 10, "ALL", null, null, null, "2026-07-10");

        assertEquals(2L, result.getTotalItems());
        result.getData().forEach(r ->
                assertEquals(LocalDate.of(2026, 7, 10), r.getStartTime().toLocalDate())
        );
    }

    // ── 6. Walk-in customer uses guestName ──────────────────────────

    @Test
    void walkInCustomerUsesGuestName() {
        persistBooking("CONFIRMED", null, true, "Walk-in Guest", BASE_TIME);

        PageResponse<AdminDashboardBookingRowResponse> result =
                service.getBookingManagement(1, 10, "ALL", null, null, null, null);

        assertEquals(1L, result.getTotalItems());
        AdminDashboardBookingRowResponse row = result.getData().get(0);
        assertTrue(row.isWalkIn());
        assertEquals("Walk-in Guest", row.getCustomerName());
    }

    // ── 7. Registered customer uses user.fullName ───────────────────

    @Test
    void registeredCustomerUsesUserFullName() {
        persistBooking("CONFIRMED", customerId, false, null, BASE_TIME);

        PageResponse<AdminDashboardBookingRowResponse> result =
                service.getBookingManagement(1, 10, "ALL", null, null, null, null);

        assertEquals(1L, result.getTotalItems());
        AdminDashboardBookingRowResponse row = result.getData().get(0);
        assertFalse(row.isWalkIn());
        assertEquals("Nguyen Van A", row.getCustomerName());
    }

    // ── 8. Empty result when no bookings match ──────────────────────

    @Test
    void emptyResultWhenNothingMatches() {
        persistBooking("CONFIRMED", customerId, false, null, BASE_TIME);

        PageResponse<AdminDashboardBookingRowResponse> result =
                service.getBookingManagement(1, 10, "CANCELED", null, null, null, null);

        assertEquals(0L, result.getTotalItems());
        assertTrue(result.getData().isEmpty());
    }

    // ── 9. Garage and service package names are resolved ────────────

    @Test
    void garageAndPackageNamesAreResolved() {
        persistBooking("CONFIRMED", customerId, false, null, BASE_TIME);

        PageResponse<AdminDashboardBookingRowResponse> result =
                service.getBookingManagement(1, 10, "ALL", null, null, null, null);

        assertEquals(1L, result.getTotalItems());
        AdminDashboardBookingRowResponse row = result.getData().get(0);
        assertEquals("Test Garage", row.getGarageName());
        assertEquals("Basic Wash", row.getServicePackageName());
    }

    // ── 10. Status param within tab acts as exact filter ────────────

    @Test
    void statusParamWithinTabFiltersExact() {
        persistBooking("CHECKED_IN",  customerId, false, null, BASE_TIME);
        persistBooking("IN_PROGRESS", customerId, false, null, BASE_TIME.plusHours(1));

        // Filter IN_PROGRESS tab with exact status = CHECKED_IN
        PageResponse<AdminDashboardBookingRowResponse> result =
                service.getBookingManagement(1, 10, "IN_PROGRESS", null, null, "CHECKED_IN", null);

        assertEquals(1L, result.getTotalItems());
        assertEquals("CHECKED_IN", result.getData().get(0).getStatus());
    }

    /* ── Helper ─────────────────────────────────────────────────── */
    private Booking persistBooking(String status, Long cId, boolean isWalkIn, String guestName,
                                   LocalDateTime startTime) {
        Booking b = new Booking();
        b.setCustomerId(cId);
        b.setGarageId(garageId);
        b.setServicePackageId(servicePackageId);
        b.setVehicleType("CAR");
        b.setBookingDate(startTime.toLocalDate());
        b.setStartTime(startTime);
        b.setEndTime(startTime.plusMinutes(60));
        b.setStatus(status);
        b.setPaymentStatus("PENDING");
        b.setOriginalPrice(new BigDecimal("150000"));
        b.setSurchargeAmount(BigDecimal.ZERO);
        b.setDiscountAmount(BigDecimal.ZERO);
        b.setPromotionDiscountAmount(BigDecimal.ZERO);
        b.setFinalPrice(new BigDecimal("150000"));
        b.setDepositAmount(BigDecimal.ZERO);
        b.setDepositStatus("UNPAID");
        b.setRefundAmount(BigDecimal.ZERO);
        b.setIsWalkIn(isWalkIn);
        b.setGuestName(guestName);
        b.setRewardProcessed(false);
        b.setUsedPoints(0);
        return em.persistAndFlush(b);
    }
}
