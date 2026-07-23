package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CareAssignmentRequest;
import com.autowashpro.dto.response.AssignedCareStaffResponse;
import com.autowashpro.dto.response.CareAssignmentStatusResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.BookingAssignedStaff;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.User;
import com.autowashpro.entity.VehicleInspection;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.repository.BookingAddOnServicePackageRepository;
import com.autowashpro.repository.BookingAssignedStaffRepository;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.BookingServiceStepRepository;
import com.autowashpro.repository.CustomerLoyaltyRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.LoyaltyTierRuleRepository;
import com.autowashpro.repository.PaymentTransactionRepository;
import com.autowashpro.repository.PointTransactionRepository;
import com.autowashpro.repository.PromotionRepository;
import com.autowashpro.repository.PromotionUsageRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.ServicePackageStepRepository;
import com.autowashpro.repository.StaffProfileRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.repository.VehicleInspectionRepository;
import com.autowashpro.repository.VehicleRepository;
import com.autowashpro.repository.WashBayRepository;
import com.autowashpro.service.BookingReviewService;
import com.autowashpro.service.EmailService;
import com.autowashpro.service.LoyaltyPointExpiryService;
import com.autowashpro.service.LoyaltyService;
import com.autowashpro.service.NotificationService;
import com.autowashpro.service.PromotionService;
import com.autowashpro.service.WashHistoryService;
import com.autowashpro.service.support.PackageResourceResolver;
import com.autowashpro.service.support.StaffOperationAccessPolicy;
import com.autowashpro.support.TestFixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Phase-aware care assignment tests covering:
 * - RELEASED history returned in getAssignedCareStaff
 * - Phase-aware shortage/canAssign in getCareAssignmentStatus
 * - assignCareStaff phase gate and duplicate-record handling
 * - completeService care-booking inspection requirements
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CareAssignmentPhaseAwareTest {

    @Mock GarageRepository garageRepository;
    @Mock ServicePackageRepository servicePackageRepository;
    @Mock WashBayRepository washBayRepository;
    @Mock BookingRepository bookingRepository;
    @Mock VehicleRepository vehicleRepository;
    @Mock CustomerLoyaltyRepository customerLoyaltyRepository;
    @Mock LoyaltyTierRuleRepository loyaltyTierRuleRepository;
    @Mock PromotionRepository promotionRepository;
    @Mock PromotionUsageRepository promotionUsageRepository;
    @Mock BookingAssignedStaffRepository bookingAssignedStaffRepository;
    @Mock StaffProfileRepository staffProfileRepository;
    @Mock UserRepository userRepository;
    @Mock BookingServiceStepRepository bookingServiceStepRepository;
    @Mock ServicePackageStepRepository servicePackageStepRepository;
    @Mock VehicleInspectionRepository vehicleInspectionRepository;
    @Mock BookingAddOnServicePackageRepository bookingAddOnServicePackageRepository;
    @Mock PointTransactionRepository pointTransactionRepository;
    @Mock PaymentTransactionRepository paymentTransactionRepository;
    @Mock LoyaltyService loyaltyService;
    @Mock LoyaltyPointExpiryService loyaltyPointExpiryService;
    @Mock WashHistoryService washHistoryService;
    @Mock PromotionService promotionService;
    @Mock NotificationService notificationService;
    @Mock EmailService emailService;
    @Mock BookingReviewService bookingReviewService;
    @Mock ComboStepResolver comboStepResolver;
    @Mock PackageResourceResolver packageResourceResolver;
    @Mock StaffOperationAccessPolicy staffOperationAccessPolicy;

    @InjectMocks BookingServiceImpl bookingService;

    private Garage garage;
    private User staffUser;
    private ServicePackage carePkg;
    private StaffProfile careProfile;

    @BeforeEach
    void setUp() {
        garage = TestFixtures.garage();
        staffUser = TestFixtures.staff();
        carePkg = TestFixtures.carWashPackage(); // requiresCareStaff=true, count=1
        User careUser = TestFixtures.user(5L, "Care Person", "care@g.io", "0999000005", "STAFF");
        careProfile = TestFixtures.careStaff(careUser, garage);

        // Default: package resolver returns the package itself
        lenient().when(packageResourceResolver.resolveEffectivePackages(any()))
                .thenAnswer(inv -> List.of(inv.<ServicePackage>getArgument(0)));
        // Default: no add-ons
        lenient().when(bookingAddOnServicePackageRepository.findByBookingIdOrderBySortOrderAsc(anyLong()))
                .thenReturn(List.of());
        // Default: booking save returns the argument
        lenient().when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> inv.getArgument(0));
        // Default: assignment save returns the argument
        lenient().when(bookingAssignedStaffRepository.save(any(BookingAssignedStaff.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    // ── 1: getAssignedCareStaff returns RELEASED assignment ─────────────────────

    @Test
    void getAssignedCareStaff_includesReleasedAssignment() {
        Booking booking = careBookingAtPhase("FINAL_INSPECTION");
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(assignment(booking.getId(), careProfile.getId(), "RELEASED")));
        when(staffProfileRepository.findById(careProfile.getId())).thenReturn(Optional.of(careProfile));

        List<AssignedCareStaffResponse> result =
                bookingService.getAssignedCareStaff(booking.getId(), staffUser.getId(), "ROLE_ADMIN");

        assertEquals(1, result.size());
        assertEquals("RELEASED", result.get(0).getAssignmentStatus());
        assertEquals(careProfile.getStaffCode(), result.get(0).getStaffCode());
    }

    // ── 2: RELEASED not counted as active shortage before care ───────────────────

    @Test
    void getCareAssignmentStatus_preCare_releasedNotCountedAsActive() {
        Booking booking = careBookingAtPhase("WAITING_FOR_CARE");
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(carePkg.getId())).thenReturn(Optional.of(carePkg));
        // RELEASED assignment exists but should not count toward active quota
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(assignment(booking.getId(), careProfile.getId(), "RELEASED")));

        CareAssignmentStatusResponse status =
                bookingService.getCareAssignmentStatus(booking.getId(), staffUser.getId(), "ROLE_ADMIN");

        assertEquals(0, status.getAssignedCount(), "RELEASED should not count as active pre-care");
        assertTrue(status.getShortage(), "shortage must be true when no active assignment exists");
        assertTrue(status.getCanAssign(), "canAssign must be true when shortage and pre-care phase");
    }

    // ── 3: FINAL_INSPECTION → canAssign=false, shortage=false ───────────────────

    @Test
    void getCareAssignmentStatus_finalInspection_careCompleted() {
        Booking booking = careBookingAtPhase("FINAL_INSPECTION");
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(carePkg.getId())).thenReturn(Optional.of(carePkg));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(assignment(booking.getId(), careProfile.getId(), "RELEASED")));

        CareAssignmentStatusResponse status =
                bookingService.getCareAssignmentStatus(booking.getId(), staffUser.getId(), "ROLE_ADMIN");

        assertTrue(status.getRequiresCareStaff());
        assertFalse(status.getShortage(), "No shortage after care is completed");
        assertFalse(status.getCanAssign(), "canAssign must be false at FINAL_INSPECTION");
        assertEquals(1, status.getAssignedCount(), "RELEASED counted as completed at FINAL_INSPECTION");
    }

    // ── 4: assignCareStaff at FINAL_INSPECTION → 409 ────────────────────────────

    @Test
    void assignCareStaff_finalInspectionPhase_returns409() {
        Booking booking = careBookingAtPhase("FINAL_INSPECTION");
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));

        CareAssignmentRequest req = new CareAssignmentRequest();
        req.setStaffProfileId(careProfile.getId());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), staffUser.getId(), "ROLE_ADMIN", req));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertTrue(ex.getReason().contains("FINAL_INSPECTION") || ex.getMessage().contains("FINAL_INSPECTION"));
        verify(bookingAssignedStaffRepository, never()).save(any());
    }

    // ── 5: assign same active staff → 409 business message ──────────────────────

    @Test
    void assignCareStaff_alreadyActiveAssignment_returns409() {
        // Use count=2 so quota is NOT full (1 existing < 2 required),
        // exercising the per-staff duplicate check specifically.
        ServicePackage twoPkg = ServicePackage.builder()
                .id(4L).name("Full Care 2").code("CARE-002")
                .vehicleType("CAR").serviceType("MAIN")
                .basePrice(new BigDecimal("300000")).durationMinutes(90)
                .washBayDurationMinutes(30).pointsEarned(30)
                .requiresWashBay(true).requiresCareStaff(true)
                .careStaffType("VEHICLE_CARE_STAFF").careStaffRequiredCount(2)
                .careStaffDurationMinutes(45).isActive(true).build();

        Booking booking = careBookingAtPhase("WAITING_FOR_CARE");
        booking.setServicePackageId(twoPkg.getId());
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(twoPkg.getId())).thenReturn(Optional.of(twoPkg));
        when(staffProfileRepository.findByIdWithLock(careProfile.getId())).thenReturn(Optional.of(careProfile));
        // Booking already has careProfile as RESERVED (same staff being re-assigned)
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(assignment(booking.getId(), careProfile.getId(), "RESERVED")));

        CareAssignmentRequest req = new CareAssignmentRequest();
        req.setStaffProfileId(careProfile.getId());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), staffUser.getId(), "ROLE_ADMIN", req));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertTrue(ex.getReason().contains("already assigned") || ex.getMessage().contains("already assigned"),
                "Message must say 'already assigned', got: " + ex.getMessage());
        verify(bookingAssignedStaffRepository, never()).save(any());
    }

    // ── 6: assign same CANCELED staff + valid phase → reuse record, no INSERT ───

    @Test
    void assignCareStaff_canceledRecord_reusesRecordNoInsert() {
        Booking booking = careBookingAtPhase("WAITING_FOR_CARE");
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(carePkg.getId())).thenReturn(Optional.of(carePkg));
        when(staffProfileRepository.findByIdWithLock(careProfile.getId())).thenReturn(Optional.of(careProfile));

        BookingAssignedStaff canceledRecord = assignment(booking.getId(), careProfile.getId(), "CANCELED");
        canceledRecord.setId(77L);
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(canceledRecord));
        // findByBookingId called twice: once for currentCount, once later
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(canceledRecord));

        CareAssignmentRequest req = new CareAssignmentRequest();
        req.setStaffProfileId(careProfile.getId());

        bookingService.assignCareStaff(booking.getId(), staffUser.getId(), "ROLE_ADMIN", req);

        // Must UPDATE (save the existing record), not INSERT (save a new record without ID)
        verify(bookingAssignedStaffRepository).save(argThat(a ->
                Long.valueOf(77L).equals(a.getId()) && "RESERVED".equals(a.getStatus())));
    }

    // ── 7: assign same RELEASED staff → 409 (no SQL constraint exposed) ─────────

    @Test
    void assignCareStaff_releasedRecord_returns409BusinessMessage() {
        Booking booking = careBookingAtPhase("WAITING_FOR_CARE");
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(carePkg.getId())).thenReturn(Optional.of(carePkg));
        when(staffProfileRepository.findByIdWithLock(careProfile.getId())).thenReturn(Optional.of(careProfile));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(assignment(booking.getId(), careProfile.getId(), "RELEASED")));

        CareAssignmentRequest req = new CareAssignmentRequest();
        req.setStaffProfileId(careProfile.getId());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), staffUser.getId(), "ROLE_ADMIN", req));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        // Must be a business message, not a SQL/constraint message
        assertTrue(ex.getReason().contains("completed") || ex.getMessage().contains("completed"),
                "Error must mention 'completed', not SQL constraint text");
        verify(bookingAssignedStaffRepository, never()).save(any());
    }

    // ── 8: getAvailableCareStaff at FINAL_INSPECTION → empty list ───────────────

    @Test
    void getAvailableCareStaff_finalInspectionPhase_returnsEmptyList() {
        Booking booking = careBookingAtPhase("FINAL_INSPECTION");
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        List<?> result =
                bookingService.getAvailableCareStaff(booking.getId(), staffUser.getId(), "ROLE_ADMIN");

        assertTrue(result.isEmpty(), "Available staff must be empty at FINAL_INSPECTION");
        verify(bookingAssignedStaffRepository, never()).findAvailableStaff(any(), any(), any(), any());
    }

    // ── 9: VEHICLE_CARE_STAFF role → 403 ─────────────────────────────────────────

    @Test
    void assignCareStaff_vehicleCareStaffRole_returns403() {
        User vcsUser = TestFixtures.user(6L, "VCS User", "vcs@g.io", "0999000006", "STAFF");
        StaffProfile vcsProfile = new StaffProfile();
        vcsProfile.setId(3L);
        vcsProfile.setUser(vcsUser);
        vcsProfile.setGarageId(garage.getId());
        vcsProfile.setStaffCode("VCS-TEST");
        vcsProfile.setStaffType(StaffType.VEHICLE_CARE_STAFF);
        vcsProfile.setIsActive(true);

        when(staffProfileRepository.findByUser_Id(vcsUser.getId())).thenReturn(Optional.of(vcsProfile));

        Booking booking = careBookingAtPhase("WAITING_FOR_CARE");
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));

        CareAssignmentRequest req = new CareAssignmentRequest();
        req.setStaffProfileId(careProfile.getId());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), vcsUser.getId(), "ROLE_STAFF", req));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(bookingAssignedStaffRepository, never()).save(any());
    }

    // ── 10: CSS wrong garage → 403 ───────────────────────────────────────────────

    @Test
    void assignCareStaff_cssWrongGarage_returns403() {
        User cssUser = TestFixtures.user(7L, "CSS Wrong", "css2@g.io", "0999000007", "STAFF");
        StaffProfile cssProfile = new StaffProfile();
        cssProfile.setId(4L);
        cssProfile.setUser(cssUser);
        cssProfile.setGarageId(999L); // different garage
        cssProfile.setStaffCode("CSS-WRONG");
        cssProfile.setStaffType(StaffType.CUSTOMER_SERVICE_STAFF);
        cssProfile.setIsActive(true);

        when(staffProfileRepository.findByUser_Id(cssUser.getId())).thenReturn(Optional.of(cssProfile));

        Booking booking = careBookingAtPhase("WAITING_FOR_CARE");
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));

        CareAssignmentRequest req = new CareAssignmentRequest();
        req.setStaffProfileId(careProfile.getId());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), cssUser.getId(), "ROLE_STAFF", req));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // ── 11: Admin reads assigned care staff history ───────────────────────────────

    @Test
    void getAssignedCareStaff_adminCanReadHistory() {
        Booking booking = careBookingAtPhase("FINAL_INSPECTION");
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(
                        assignment(booking.getId(), careProfile.getId(), "RELEASED"),
                        assignment(booking.getId(), 99L, "CANCELED") // CANCELED should be excluded
                ));
        when(staffProfileRepository.findById(careProfile.getId())).thenReturn(Optional.of(careProfile));
        when(staffProfileRepository.findById(99L)).thenReturn(Optional.empty());

        User admin = TestFixtures.admin();
        List<AssignedCareStaffResponse> result =
                bookingService.getAssignedCareStaff(booking.getId(), admin.getId(), "ROLE_ADMIN");

        assertEquals(1, result.size(), "CANCELED should be excluded; RELEASED should be included");
        assertEquals("RELEASED", result.get(0).getAssignmentStatus());
    }

    // ── 12: completeService care booking at READY_FOR_HANDOVER, missing AFTER_WASH → 400

    @Test
    void completeService_careBooking_missingAfterWash_returns400() {
        ServicePackage pkg = TestFixtures.carWashPackage(); // requiresCareStaff=true
        Booking booking = careBookingAtPhase("READY_FOR_HANDOVER");
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        // Only BEFORE_WASH — missing AFTER_WASH
        when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .thenReturn(List.of(inspection("BEFORE_WASH")));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.completeService(booking.getId(), staffUser.getId(), "ROLE_ADMIN", null));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("AFTER_WASH") || ex.getMessage().contains("AFTER_WASH"));
        verify(bookingRepository, never()).save(argThat(b -> "COMPLETED".equals(b.getStatus())));
    }

    // ── 13: completeService with READY_FOR_HANDOVER + AFTER_WASH → COMPLETED ─────

    @Test
    void completeService_careBooking_allConditionsMet_completes() {
        ServicePackage pkg = TestFixtures.carWashPackage();
        Booking booking = careBookingAtPhase("READY_FOR_HANDOVER");
        booking.setCareStartedAt(LocalDateTime.now().minusHours(1));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .thenReturn(List.of(inspection("BEFORE_WASH"), inspection("AFTER_WASH")));

        var response = bookingService.completeService(booking.getId(), staffUser.getId(), "ROLE_ADMIN", null);

        assertEquals("COMPLETED", response.getStatus());
    }

    // ── 14: no-care booking doesn't require AFTER_WASH ───────────────────────────

    @Test
    void completeService_noCareBooking_doesNotRequireAfterWash() {
        ServicePackage noCarePkg = ServicePackage.builder()
                .id(3L).name("Wash Only").code("WASH-ONLY")
                .vehicleType("CAR").serviceType("MAIN")
                .basePrice(new BigDecimal("100000")).durationMinutes(45)
                .washBayDurationMinutes(30).pointsEarned(10)
                .requiresWashBay(true).requiresCareStaff(false)
                .careStaffRequiredCount(0).careStaffDurationMinutes(0)
                .isActive(true).build();

        Booking booking = new Booking();
        booking.setId(55L);
        booking.setCustomerId(1L);
        booking.setVehicleId(1L);
        booking.setGarageId(garage.getId());
        booking.setServicePackageId(noCarePkg.getId());
        booking.setStartTime(TestFixtures.BASE_TIME);
        booking.setEndTime(TestFixtures.BASE_TIME.plusMinutes(45));
        booking.setStatus("IN_PROGRESS");
        booking.setOperationPhase("READY_FOR_HANDOVER");
        booking.setVehicleType("CAR");
        booking.setPaymentStatus("UNPAID");
        booking.setOriginalPrice(noCarePkg.getBasePrice());
        booking.setSurchargeAmount(BigDecimal.ZERO);
        booking.setDiscountAmount(BigDecimal.ZERO);
        booking.setPromotionDiscountAmount(BigDecimal.ZERO);
        booking.setFinalPrice(noCarePkg.getBasePrice());
        booking.setDepositAmount(BigDecimal.ZERO);
        booking.setDepositStatus("PAID");
        booking.setRefundAmount(BigDecimal.ZERO);
        booking.setIsWalkIn(false);
        booking.setRewardProcessed(false);
        booking.setUsedPoints(0);

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(noCarePkg.getId())).thenReturn(Optional.of(noCarePkg));
        // Only BEFORE_WASH — no AFTER_WASH, which is correct for no-care bookings
        when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .thenReturn(List.of(inspection("BEFORE_WASH")));

        var response = bookingService.completeService(booking.getId(), staffUser.getId(), "ROLE_ADMIN", null);

        assertEquals("COMPLETED", response.getStatus(), "No-care booking should complete without AFTER_WASH");
    }

    // ── 15: second assign (active staff already full) → 409, no over-assign ─────

    @Test
    void assignCareStaff_alreadyFullQuota_returns409() {
        Booking booking = careBookingAtPhase("WAITING_FOR_CARE");
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(carePkg.getId())).thenReturn(Optional.of(carePkg));
        when(staffProfileRepository.findByIdWithLock(careProfile.getId())).thenReturn(Optional.of(careProfile));

        // Quota is already full: 1 RESERVED assignment for a different staff member
        BookingAssignedStaff existingDifferentStaff = assignment(booking.getId(), 98L, "RESERVED");
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(existingDifferentStaff));

        CareAssignmentRequest req = new CareAssignmentRequest();
        req.setStaffProfileId(careProfile.getId()); // different staff, but quota full

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), staffUser.getId(), "ROLE_ADMIN", req));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        verify(bookingAssignedStaffRepository, never()).save(any());
    }

    // ── helpers ──────────────────────────────────────────────────────────────────

    private Booking careBookingAtPhase(String phase) {
        Booking b = new Booking();
        b.setId(33L);
        b.setCustomerId(1L);
        b.setVehicleId(1L);
        b.setGarageId(garage.getId());
        b.setServicePackageId(carePkg.getId());
        b.setStartTime(TestFixtures.BASE_TIME);
        b.setEndTime(TestFixtures.BASE_TIME.plusMinutes(90));
        b.setStatus("IN_PROGRESS");
        b.setOperationPhase(phase);
        b.setPlannedCareStartAt(TestFixtures.BASE_TIME.plusMinutes(45));
        b.setPlannedCareEndAt(TestFixtures.BASE_TIME.plusMinutes(90));
        b.setVehicleType("CAR");
        b.setPaymentStatus("UNPAID");
        b.setOriginalPrice(carePkg.getBasePrice());
        b.setSurchargeAmount(BigDecimal.ZERO);
        b.setDiscountAmount(BigDecimal.ZERO);
        b.setPromotionDiscountAmount(BigDecimal.ZERO);
        b.setFinalPrice(carePkg.getBasePrice());
        b.setDepositAmount(BigDecimal.ZERO);
        b.setDepositStatus("PAID");
        b.setRefundAmount(BigDecimal.ZERO);
        b.setIsWalkIn(false);
        b.setRewardProcessed(false);
        b.setUsedPoints(0);
        return b;
    }

    private BookingAssignedStaff assignment(Long bookingId, Long profileId, String status) {
        BookingAssignedStaff a = new BookingAssignedStaff();
        a.setId((long) (Math.random() * 10000 + 1));
        a.setBookingId(bookingId);
        a.setStaffProfileId(profileId);
        a.setRoleInBooking("VEHICLE_CARE_STAFF");
        a.setStatus(status);
        a.setAssignedFrom(TestFixtures.BASE_TIME.plusMinutes(45));
        a.setAssignedTo(TestFixtures.BASE_TIME.plusMinutes(90));
        return a;
    }

    private VehicleInspection inspection(String type) {
        VehicleInspection i = new VehicleInspection();
        i.setType(type);
        return i;
    }

}
