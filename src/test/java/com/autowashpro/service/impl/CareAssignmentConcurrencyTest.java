package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CareAssignmentRequest;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.User;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.repository.BookingAssignedStaffRepository;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.StaffProfileRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.service.BookingService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Real concurrency integration tests for assignCareStaff.
 *
 * Runs on H2 in-memory database in MSSQL-compatibility mode (application-test.properties).
 * This validates transaction isolation and pessimistic-locking behaviour in the TEST
 * environment only — it is NOT a SQL Server production integration test.
 *
 * Each worker runs assignCareStaff() in its own @Transactional opened by the service method.
 * The test method holds no transaction so that committed fixture data is visible to all threads.
 * Pessimistic write locks (SELECT … FOR UPDATE) serialise concurrent assignments.
 *
 * Exception contract:
 *   - Exactly one worker must succeed (return normally).
 *   - The other must receive HTTP 409 CONFLICT from the service.
 *   - Any other exception (SQL error, deadlock, NPE, wrong HTTP status) is an unexpected
 *     failure that makes the test fail — it is NOT silently counted as a conflict.
 */
@SpringBootTest
@ActiveProfiles("test")
class CareAssignmentConcurrencyTest {

    @Autowired private BookingService bookingService;
    @Autowired private TransactionTemplate transactionTemplate;

    @Autowired private UserRepository userRepository;
    @Autowired private StaffProfileRepository staffProfileRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private ServicePackageRepository servicePackageRepository;
    @Autowired private GarageRepository garageRepository;
    @Autowired private BookingAssignedStaffRepository bookingAssignedStaffRepository;

    private Long cssUserId;
    private Long care1ProfileId;
    private Long care2ProfileId;
    private Long bookingId;
    private Long booking2Id;

    private final List<Long> createdUserIds    = new ArrayList<>();
    private final List<Long> createdProfileIds = new ArrayList<>();
    private final List<Long> createdBookingIds = new ArrayList<>();
    private Long createdPkgId;
    private Long createdGarageId;

    @BeforeEach
    void setUp() {
        transactionTemplate.execute(status -> {
            Garage garage = new Garage();
            garage.setName("IT Concurrency Garage");
            garage.setGarageCode("IT-CONC-" + System.nanoTime());
            garage.setAddress("1 Test Street");
            garage.setCity("HCMC");
            garage.setPhone("0283000099");
            garage.setOpeningTime(LocalTime.of(7, 0));
            garage.setClosingTime(LocalTime.of(21, 0));
            garage.setSlotIntervalMinutes(30);
            garage.setIsActive(true);
            garageRepository.save(garage);
            createdGarageId = garage.getId();

            ServicePackage pkg = ServicePackage.builder()
                    .name("IT Care Pkg Conc")
                    .code("IT-CARE-CONC-" + System.nanoTime())
                    .vehicleType("CAR")
                    .serviceType("MAIN")
                    .basePrice(new BigDecimal("200000.00"))
                    .durationMinutes(90)
                    .washBayDurationMinutes(30)
                    .requiresWashBay(false)
                    .requiresCareStaff(true)
                    .careStaffType("VEHICLE_CARE_STAFF")
                    .careStaffRequiredCount(1)
                    .careStaffDurationMinutes(60)
                    .pointsEarned(20)
                    .isActive(true)
                    .build();
            servicePackageRepository.save(pkg);
            createdPkgId = pkg.getId();

            User cssUser = user("css-conc-" + System.nanoTime() + "@test.local");
            userRepository.save(cssUser);
            cssUserId = cssUser.getId();
            createdUserIds.add(cssUserId);
            StaffProfile cssProfile = profile(cssUser, createdGarageId,
                    "CSS-IT-" + System.nanoTime(), StaffType.CUSTOMER_SERVICE_STAFF);
            staffProfileRepository.save(cssProfile);
            createdProfileIds.add(cssProfile.getId());

            User cu1 = user("care1-conc-" + System.nanoTime() + "@test.local");
            userRepository.save(cu1);
            createdUserIds.add(cu1.getId());
            StaffProfile cp1 = profile(cu1, createdGarageId,
                    "CARE-IT1-" + System.nanoTime(), StaffType.VEHICLE_CARE_STAFF);
            staffProfileRepository.save(cp1);
            care1ProfileId = cp1.getId();
            createdProfileIds.add(care1ProfileId);

            User cu2 = user("care2-conc-" + System.nanoTime() + "@test.local");
            userRepository.save(cu2);
            createdUserIds.add(cu2.getId());
            StaffProfile cp2 = profile(cu2, createdGarageId,
                    "CARE-IT2-" + System.nanoTime(), StaffType.VEHICLE_CARE_STAFF);
            staffProfileRepository.save(cp2);
            care2ProfileId = cp2.getId();
            createdProfileIds.add(care2ProfileId);

            LocalDateTime t0 = LocalDateTime.of(2027, 8, 1, 10, 0);
            Booking b1 = booking(createdGarageId, createdPkgId,
                    t0, t0.plusMinutes(90), t0.plusMinutes(30), t0.plusMinutes(90));
            bookingRepository.save(b1);
            bookingId = b1.getId();
            createdBookingIds.add(bookingId);

            Booking b2 = booking(createdGarageId, createdPkgId,
                    t0.plusMinutes(15), t0.plusMinutes(105),
                    t0.plusMinutes(45), t0.plusMinutes(105));
            bookingRepository.save(b2);
            booking2Id = b2.getId();
            createdBookingIds.add(booking2Id);

            return null;
        });
    }

    @AfterEach
    void tearDown() {
        transactionTemplate.execute(status -> {
            bookingAssignedStaffRepository.findAll().stream()
                    .filter(a -> createdBookingIds.contains(a.getBookingId()))
                    .forEach(bookingAssignedStaffRepository::delete);
            createdBookingIds.forEach(id ->
                    bookingRepository.findById(id).ifPresent(bookingRepository::delete));
            createdProfileIds.forEach(id ->
                    staffProfileRepository.findById(id).ifPresent(staffProfileRepository::delete));
            createdUserIds.forEach(id ->
                    userRepository.findById(id).ifPresent(userRepository::delete));
            servicePackageRepository.findById(createdPkgId)
                    .ifPresent(servicePackageRepository::delete);
            garageRepository.findById(createdGarageId)
                    .ifPresent(garageRepository::delete);
            return null;
        });
    }

    // ── Scenario A ──────────────────────────────────────────────────────────

    /**
     * Two concurrent CSS requests assign DIFFERENT care staff to the SAME booking
     * (requiredCareStaffCount=1). The pessimistic write lock on the booking row
     * serialises the two transactions: the second sees currentCount=1 after the
     * first commits and must be rejected with HTTP 409.
     */
    @Test
    void scenarioA_concurrentAssignDifferentStaffSameBooking_onlyOneSucceeds() throws Exception {
        CareAssignmentRequest req1 = new CareAssignmentRequest();
        req1.setStaffProfileId(care1ProfileId);
        CareAssignmentRequest req2 = new CareAssignmentRequest();
        req2.setStaffProfileId(care2ProfileId);

        AtomicInteger successCount  = new AtomicInteger(0);
        AtomicInteger conflictCount = new AtomicInteger(0);
        AtomicReference<Throwable> unexpected1 = new AtomicReference<>();
        AtomicReference<Throwable> unexpected2 = new AtomicReference<>();
        CyclicBarrier barrier = new CyclicBarrier(2);
        CountDownLatch done   = new CountDownLatch(2);
        ExecutorService pool  = Executors.newFixedThreadPool(2);

        pool.submit(() -> {
            try {
                barrier.await(5, TimeUnit.SECONDS);
                bookingService.assignCareStaff(bookingId, cssUserId, "ROLE_STAFF", req1);
                successCount.incrementAndGet();
            } catch (ResponseStatusException e) {
                if (HttpStatus.CONFLICT.equals(e.getStatusCode())) {
                    conflictCount.incrementAndGet();
                } else {
                    unexpected1.set(e);
                }
            } catch (Throwable t) {
                unexpected1.set(t);
            } finally {
                done.countDown();
            }
        });

        pool.submit(() -> {
            try {
                barrier.await(5, TimeUnit.SECONDS);
                bookingService.assignCareStaff(bookingId, cssUserId, "ROLE_STAFF", req2);
                successCount.incrementAndGet();
            } catch (ResponseStatusException e) {
                if (HttpStatus.CONFLICT.equals(e.getStatusCode())) {
                    conflictCount.incrementAndGet();
                } else {
                    unexpected2.set(e);
                }
            } catch (Throwable t) {
                unexpected2.set(t);
            } finally {
                done.countDown();
            }
        });

        try {
            assertTrue(done.await(20, TimeUnit.SECONDS), "Workers timed out — possible deadlock");

            assertNull(unexpected1.get(),
                    "Worker 1 threw unexpected exception: " + unexpected1.get());
            assertNull(unexpected2.get(),
                    "Worker 2 threw unexpected exception: " + unexpected2.get());
            assertEquals(1, successCount.get(),  "Exactly one assignment must succeed");
            assertEquals(1, conflictCount.get(), "The other must be rejected with HTTP 409");
            assertEquals(1, activeCareCount(bookingId),
                    "DB must contain exactly one active VEHICLE_CARE_STAFF assignment for the booking");
        } finally {
            pool.shutdownNow();
        }
    }

    // ── Scenario B ──────────────────────────────────────────────────────────

    /**
     * Two concurrent CSS requests assign the SAME care staff to TWO DIFFERENT bookings
     * whose care windows overlap. The pessimistic write lock on the care staff profile row
     * serialises the two transactions: after the first commits, the second sees the
     * overlapping assignment and must be rejected with HTTP 409.
     */
    @Test
    void scenarioB_concurrentAssignSameStaffOverlappingBookings_onlyOneSucceeds() throws Exception {
        CareAssignmentRequest reqB1 = new CareAssignmentRequest();
        reqB1.setStaffProfileId(care1ProfileId);
        CareAssignmentRequest reqB2 = new CareAssignmentRequest();
        reqB2.setStaffProfileId(care1ProfileId);

        AtomicInteger successCount  = new AtomicInteger(0);
        AtomicInteger conflictCount = new AtomicInteger(0);
        AtomicReference<Throwable> unexpected1 = new AtomicReference<>();
        AtomicReference<Throwable> unexpected2 = new AtomicReference<>();
        CyclicBarrier barrier = new CyclicBarrier(2);
        CountDownLatch done   = new CountDownLatch(2);
        ExecutorService pool  = Executors.newFixedThreadPool(2);

        pool.submit(() -> {
            try {
                barrier.await(5, TimeUnit.SECONDS);
                bookingService.assignCareStaff(bookingId, cssUserId, "ROLE_STAFF", reqB1);
                successCount.incrementAndGet();
            } catch (ResponseStatusException e) {
                if (HttpStatus.CONFLICT.equals(e.getStatusCode())) {
                    conflictCount.incrementAndGet();
                } else {
                    unexpected1.set(e);
                }
            } catch (Throwable t) {
                unexpected1.set(t);
            } finally {
                done.countDown();
            }
        });

        pool.submit(() -> {
            try {
                barrier.await(5, TimeUnit.SECONDS);
                bookingService.assignCareStaff(booking2Id, cssUserId, "ROLE_STAFF", reqB2);
                successCount.incrementAndGet();
            } catch (ResponseStatusException e) {
                if (HttpStatus.CONFLICT.equals(e.getStatusCode())) {
                    conflictCount.incrementAndGet();
                } else {
                    unexpected2.set(e);
                }
            } catch (Throwable t) {
                unexpected2.set(t);
            } finally {
                done.countDown();
            }
        });

        try {
            assertTrue(done.await(20, TimeUnit.SECONDS), "Workers timed out — possible deadlock");

            assertNull(unexpected1.get(),
                    "Worker 1 threw unexpected exception: " + unexpected1.get());
            assertNull(unexpected2.get(),
                    "Worker 2 threw unexpected exception: " + unexpected2.get());
            assertEquals(1, successCount.get(),  "Exactly one assignment must succeed");
            assertEquals(1, conflictCount.get(), "The other must be rejected with HTTP 409");
            assertEquals(1, activeCareCountByStaff(care1ProfileId),
                    "DB must contain exactly one active assignment for this care staff across all bookings");
        } finally {
            pool.shutdownNow();
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private long activeCareCount(Long bId) {
        return bookingAssignedStaffRepository.findByBookingId(bId).stream()
                .filter(a -> "VEHICLE_CARE_STAFF".equals(a.getRoleInBooking())
                        && ("ASSIGNED".equals(a.getStatus())
                                || "RESERVED".equals(a.getStatus())
                                || "ACTIVE".equals(a.getStatus())))
                .count();
    }

    private long activeCareCountByStaff(Long staffProfileId) {
        return bookingAssignedStaffRepository.findByStaffProfileId(staffProfileId).stream()
                .filter(a -> "VEHICLE_CARE_STAFF".equals(a.getRoleInBooking())
                        && ("ASSIGNED".equals(a.getStatus())
                                || "RESERVED".equals(a.getStatus())
                                || "ACTIVE".equals(a.getStatus())))
                .count();
    }

    private User user(String email) {
        User u = new User();
        u.setFullName("IT Concurrency User");
        u.setEmail(email);
        // H2 unique index treats NULL as equal for google_id; use a unique placeholder
        // so this test's users do not collide with other @SpringBootTest tests that share
        // the same in-memory DB context.
        u.setGoogleId("it-dummy-" + email.hashCode());
        u.setPhone("09" + (Math.abs(email.hashCode()) % 100_000_000L));
        u.setPasswordHash("$2a$10$encodedHash");
        u.setRole("STAFF");
        u.setAuthProvider("LOCAL");
        u.setIsActive(true);
        return u;
    }

    private StaffProfile profile(User user, Long garageId, String code, StaffType type) {
        StaffProfile p = new StaffProfile();
        p.setUser(user);
        p.setGarageId(garageId);
        p.setStaffCode(code);
        p.setStaffType(type);
        p.setIsActive(true);
        return p;
    }

    private Booking booking(Long garageId, Long pkgId,
                            LocalDateTime start, LocalDateTime end,
                            LocalDateTime careStart, LocalDateTime careEnd) {
        Booking b = new Booking();
        b.setGarageId(garageId);
        b.setServicePackageId(pkgId);
        b.setStartTime(start);
        b.setEndTime(end);
        b.setPlannedCareStartAt(careStart);
        b.setPlannedCareEndAt(careEnd);
        b.setStatus("CONFIRMED");
        b.setVehicleType("CAR");
        b.setPaymentStatus("UNPAID");
        b.setOriginalPrice(new BigDecimal("200000.00"));
        b.setSurchargeAmount(BigDecimal.ZERO);
        b.setDiscountAmount(BigDecimal.ZERO);
        b.setPromotionDiscountAmount(BigDecimal.ZERO);
        b.setFinalPrice(new BigDecimal("200000.00"));
        b.setDepositAmount(BigDecimal.ZERO);
        b.setDepositStatus("NOT_REQUIRED");
        b.setRefundAmount(BigDecimal.ZERO);
        b.setIsWalkIn(true);
        b.setRewardProcessed(false);
        b.setUsedPoints(0);
        return b;
    }
}
