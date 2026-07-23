package com.autowashpro.service.impl;

import com.autowashpro.dto.request.VehicleInspectionCreateRequest;
import com.autowashpro.dto.request.VehicleInspectionUpdateRequest;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.BookingServiceStep;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.User;
import com.autowashpro.entity.VehicleInspection;
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
import com.autowashpro.repository.VehicleInspectionImageRepository;
import com.autowashpro.repository.VehicleInspectionRepository;
import com.autowashpro.repository.VehicleRepository;
import com.autowashpro.repository.WashBayRepository;
import com.autowashpro.service.BookingReviewService;
import com.autowashpro.service.EmailService;
import com.autowashpro.service.LoyaltyPointExpiryService;
import com.autowashpro.service.LoyaltyService;
import com.autowashpro.service.NotificationService;
import com.autowashpro.service.PromotionService;
import com.autowashpro.service.UploadService;
import com.autowashpro.service.WashHistoryService;
import com.autowashpro.service.support.InspectionAccessPolicy;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Mandatory tests for the INTAKE_INSPECTION auto-complete workflow.
 *
 * Verifies:
 * 1–4. VehicleInspectionServiceImpl.create/update(BEFORE_WASH) auto-completes only INTAKE_INSPECTION steps
 * 5–6. BookingServiceImpl.startWash auto-completes intake steps; blocked without BEFORE_WASH inspection
 * 7.   completeWash ignores INTAKE_INSPECTION steps in phase validation
 * 8–9. Stale AFTER_WASH blocks completeFinalInspection; fresh AFTER_WASH allows it
 * 10.  Null/blank executionPhase fails closed in completeWash (unclassified pending step → 409)
 * 11.  Authorization on completeFinalInspection unchanged (staffOperationAccessPolicy called)
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class IntakeInspectionAutoCompleteTest {

    // ── Shared mocks (cover both services under test) ────────────────────────

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

    // VehicleInspectionServiceImpl-only mocks
    @Mock VehicleInspectionImageRepository imageRepository;
    @Mock UploadService uploadService;
    @Mock InspectionAccessPolicy inspectionAccessPolicy;

    @InjectMocks BookingServiceImpl bookingService;
    @InjectMocks VehicleInspectionServiceImpl inspectionService;

    private Garage garage;
    private User staffUser;
    private StaffProfile staffProfile;

    @BeforeEach
    void setUp() {
        garage = TestFixtures.garage();
        staffUser = TestFixtures.staff();
        staffProfile = TestFixtures.customerServiceStaff(staffUser, garage);

        lenient().when(packageResourceResolver.resolveEffectivePackages(any()))
                .thenAnswer(inv -> List.of(inv.<ServicePackage>getArgument(0)));
        lenient().when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(anyLong(), any(), anyLong()))
                .thenReturn(null);
        lenient().when(staffOperationAccessPolicy.requireCustomerServiceOrAdmin(anyLong(), any()))
                .thenReturn(null);
        lenient().when(bookingAddOnServicePackageRepository.findByBookingIdOrderBySortOrderAsc(anyLong()))
                .thenReturn(List.of());
        lenient().when(bookingAssignedStaffRepository.findByBookingId(anyLong()))
                .thenReturn(List.of());
        lenient().when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(staffProfileRepository.findByUser_Id(staffUser.getId()))
                .thenReturn(Optional.of(staffProfile));
        lenient().when(uploadService.requireInspectionUploads(anyLong(), any(), any()))
                .thenReturn(List.of());
        lenient().when(inspectionRepository().save(any(VehicleInspection.class)))
                .thenAnswer(inv -> {
                    VehicleInspection v = inv.getArgument(0);
                    if (v.getId() == null) v.setId(99L);
                    return v;
                });
        lenient().when(bookingServiceStepRepository.save(any(BookingServiceStep.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    // ── 1: BEFORE_WASH create auto-completes only INTAKE_INSPECTION steps ────

    @Test
    void beforeWashCreate_autoCompletesOnlyIntakeInspectionSteps() {
        Booking booking = checkedInBooking();
        BookingServiceStep intakeStep = pendingStep(booking.getId(), "INTAKE_INSPECTION");
        BookingServiceStep washStep = pendingStep(booking.getId(), "AUTOMATED_WASH");
        BookingServiceStep careStep = pendingStep(booking.getId(), "VEHICLE_CARE");

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(intakeStep, washStep, careStep));

        inspectionService.create(booking.getId(), beforeWashRequest(), staffUser.getId(), "ROLE_STAFF");

        // Only the intake step must be saved as COMPLETED
        verify(bookingServiceStepRepository).save(intakeStep);
        assertEquals("COMPLETED", intakeStep.getStatus());

        // AUTOMATED_WASH and VEHICLE_CARE steps must be untouched
        verify(bookingServiceStepRepository, never()).save(washStep);
        verify(bookingServiceStepRepository, never()).save(careStep);
        assertEquals("PENDING", washStep.getStatus());
        assertEquals("PENDING", careStep.getStatus());
    }

    // ── 2: BEFORE_WASH create does NOT complete AUTOMATED_WASH steps ──────────

    @Test
    void beforeWashCreate_doesNotCompleteAutomatedWashSteps() {
        Booking booking = checkedInBooking();
        BookingServiceStep washStep = pendingStep(booking.getId(), "AUTOMATED_WASH");

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(washStep));

        inspectionService.create(booking.getId(), beforeWashRequest(), staffUser.getId(), "ROLE_STAFF");

        verify(bookingServiceStepRepository, never()).save(washStep);
        assertEquals("PENDING", washStep.getStatus());
    }

    // ── 3: BEFORE_WASH create does NOT complete VEHICLE_CARE steps ───────────

    @Test
    void beforeWashCreate_doesNotCompleteVehicleCareSteps() {
        Booking booking = checkedInBooking();
        BookingServiceStep careStep = pendingStep(booking.getId(), "VEHICLE_CARE");

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(careStep));

        inspectionService.create(booking.getId(), beforeWashRequest(), staffUser.getId(), "ROLE_STAFF");

        verify(bookingServiceStepRepository, never()).save(careStep);
        assertEquals("PENDING", careStep.getStatus());
    }

    // ── 4: BEFORE_WASH update is idempotent for already-completed intake steps

    @Test
    void beforeWashUpdate_idempotentOnAlreadyCompletedIntakeStep() {
        Booking booking = checkedInBooking();
        VehicleInspection existingInsp = existingBeforeWash(booking.getId());
        BookingServiceStep alreadyDone = completedStep(booking.getId(), "INTAKE_INSPECTION");

        when(vehicleInspectionRepository.findById(existingInsp.getId())).thenReturn(Optional.of(existingInsp));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(alreadyDone));

        VehicleInspectionUpdateRequest updateReq = new VehicleInspectionUpdateRequest();
        updateReq.setNotes("Reconfirming intake");
        inspectionService.update(existingInsp.getId(), updateReq, staffUser.getId(), "ROLE_STAFF");

        // Already-completed step must not be saved again (no duplicate updates)
        verify(bookingServiceStepRepository, never()).save(alreadyDone);
        assertEquals("COMPLETED", alreadyDone.getStatus());
    }

    // ── 5: startWash auto-completes INTAKE_INSPECTION steps ─────────────────

    @Test
    void startWash_autoCompletesIntakeInspectionSteps() {
        ServicePackage pkg = noBayPackage();
        Booking booking = waitingForIntakeBooking(pkg);
        BookingServiceStep intakeStep = pendingStep(booking.getId(), "INTAKE_INSPECTION");
        BookingServiceStep washStep = pendingStep(booking.getId(), "AUTOMATED_WASH");

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .thenReturn(List.of(beforeWashInspection(booking.getId())));
        // Return same steps on both calls (first for "existingSteps.isEmpty()?" and second for auto-complete)
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(intakeStep, washStep));

        bookingService.startWash(booking.getId(), staffUser.getId(), "ROLE_STAFF", null);

        // INTAKE_INSPECTION step must be auto-completed
        verify(bookingServiceStepRepository).save(intakeStep);
        assertEquals("COMPLETED", intakeStep.getStatus());
        assertEquals(staffUser.getId(), intakeStep.getCompletedByStaffId());

        // AUTOMATED_WASH step must remain untouched
        verify(bookingServiceStepRepository, never()).save(washStep);
        assertEquals("PENDING", washStep.getStatus());
    }

    // ── 6: startWash blocked if BEFORE_WASH inspection is missing ────────────

    @Test
    void startWash_blockedIfBeforeWashInspectionMissing() {
        ServicePackage pkg = noBayPackage();
        Booking booking = waitingForIntakeBooking(pkg);

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .thenReturn(List.of()); // no BEFORE_WASH

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.startWash(booking.getId(), staffUser.getId(), "ROLE_STAFF", null));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("WAITING_FOR_INTAKE", booking.getOperationPhase()); // phase must not have changed
        verify(bookingServiceStepRepository, never()).save(any());
    }

    // ── 7: completeWash ignores INTAKE_INSPECTION steps in phase validation ──

    @Test
    void completeWash_ignoresPendingIntakeInspectionSteps_checksOnlyAutomatedWash() {
        ServicePackage pkg = noBayPackage();
        Booking booking = automatedWashBooking(pkg);
        // INTAKE_INSPECTION step still pending (should be ignored by completeWash validation)
        BookingServiceStep intakeStep = pendingStep(booking.getId(), "INTAKE_INSPECTION");
        BookingServiceStep doneWashStep = completedStep(booking.getId(), "AUTOMATED_WASH");

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(intakeStep, doneWashStep));

        // completeWash must succeed — INTAKE_INSPECTION pending step does NOT block
        var response = bookingService.completeWash(booking.getId(), staffUser.getId(), "ROLE_STAFF", null);

        assertEquals("FINAL_INSPECTION", response.getOperationPhase());
    }

    // ── 8: Stale AFTER_WASH blocks completeFinalInspection ───────────────────

    @Test
    void completeFinalInspection_staleAfterWashInspection_returns409() {
        ServicePackage pkg = noBayPackage();
        Booking booking = finalInspectionBooking(pkg);
        LocalDateTime careCompletedAt = LocalDateTime.now().minusHours(1);
        booking.setPlannedCareStartAt(careCompletedAt.minusHours(2));
        booking.setCareCompletedAt(careCompletedAt);

        VehicleInspection beforeWash = beforeWashInspection(booking.getId());
        // AFTER_WASH recorded 2 hours before care completed → stale
        VehicleInspection staleAfterWash = afterWashInspection(booking.getId(),
                careCompletedAt.minusHours(2));

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of()); // empty → validateAllStepsCompleted passes
        when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .thenReturn(List.of(beforeWash, staleAfterWash));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.completeFinalInspection(booking.getId(), staffUser.getId(), "ROLE_ADMIN"));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertEquals("FINAL_INSPECTION", booking.getOperationPhase()); // must not have advanced
    }

    // ── 9: Fresh AFTER_WASH allows completeFinalInspection ───────────────────

    @Test
    void completeFinalInspection_freshAfterWashInspection_succeeds() {
        ServicePackage pkg = noBayPackage();
        Booking booking = finalInspectionBooking(pkg);
        LocalDateTime careCompletedAt = LocalDateTime.now().minusHours(1);
        booking.setPlannedCareStartAt(careCompletedAt.minusHours(2));
        booking.setCareCompletedAt(careCompletedAt);

        VehicleInspection beforeWash = beforeWashInspection(booking.getId());
        // AFTER_WASH updated 30 minutes AFTER care completed → fresh
        VehicleInspection freshAfterWash = afterWashInspection(booking.getId(),
                careCompletedAt.plusMinutes(30));

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of()); // empty → validateAllStepsCompleted passes
        when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .thenReturn(List.of(beforeWash, freshAfterWash));

        var response = bookingService.completeFinalInspection(booking.getId(), staffUser.getId(), "ROLE_ADMIN");

        assertEquals("READY_FOR_HANDOVER", response.getOperationPhase());
    }

    // ── 10: Null executionPhase fails closed in completeWash ─────────────────

    @Test
    void completeWash_pendingStepWithNullExecutionPhase_returns409FailClosed() {
        ServicePackage pkg = noBayPackage();
        Booking booking = automatedWashBooking(pkg);
        // A step with null executionPhase must block completion (fail-closed — misconfigured package)
        BookingServiceStep nullPhaseStep = pendingStep(booking.getId(), null);
        BookingServiceStep doneWashStep = completedStep(booking.getId(), "AUTOMATED_WASH");

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(nullPhaseStep, doneWashStep));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.completeWash(booking.getId(), staffUser.getId(), "ROLE_STAFF", null));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertEquals("AUTOMATED_WASH", booking.getOperationPhase());
    }

    // ── 11: Authorization unchanged on completeFinalInspection ───────────────

    @Test
    void completeFinalInspection_callsStaffOperationAccessPolicyForGarageCheck() {
        ServicePackage pkg = noBayPackage();
        Booking booking = finalInspectionBooking(pkg);

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of());
        when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .thenReturn(List.of(beforeWashInspection(booking.getId())));

        bookingService.completeFinalInspection(booking.getId(), staffUser.getId(), "ROLE_STAFF");

        verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(
                staffUser.getId(), "ROLE_STAFF", booking.getGarageId());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private VehicleInspectionRepository inspectionRepository() {
        return vehicleInspectionRepository;
    }

    private ServicePackage noBayPackage() {
        return ServicePackage.builder()
                .id(10L).name("Intake Wash").code("INTAKE-WASH")
                .vehicleType("CAR").serviceType("MAIN")
                .basePrice(new BigDecimal("120000.00"))
                .durationMinutes(60).washBayDurationMinutes(0)
                .requiresWashBay(false).requiresCareStaff(false)
                .careStaffRequiredCount(0).careStaffDurationMinutes(0)
                .isActive(true).build();
    }

    private Booking checkedInBooking() {
        Booking b = new Booking();
        b.setId(200L);
        b.setCustomerId(1L);
        b.setVehicleId(1L);
        b.setGarageId(garage.getId());
        b.setServicePackageId(10L);
        b.setStartTime(TestFixtures.BASE_TIME);
        b.setEndTime(TestFixtures.BASE_TIME.plusMinutes(60));
        b.setStatus("CHECKED_IN");
        b.setOperationPhase("WAITING_FOR_INTAKE");
        b.setVehicleType("CAR");
        b.setPaymentStatus("UNPAID");
        b.setOriginalPrice(new BigDecimal("120000.00"));
        b.setSurchargeAmount(BigDecimal.ZERO);
        b.setDiscountAmount(BigDecimal.ZERO);
        b.setPromotionDiscountAmount(BigDecimal.ZERO);
        b.setFinalPrice(new BigDecimal("120000.00"));
        b.setDepositAmount(BigDecimal.ZERO);
        b.setDepositStatus("PAID");
        b.setRefundAmount(BigDecimal.ZERO);
        b.setIsWalkIn(false);
        b.setRewardProcessed(false);
        b.setUsedPoints(0);
        return b;
    }

    private Booking waitingForIntakeBooking(ServicePackage pkg) {
        Booking b = checkedInBooking();
        b.setServicePackageId(pkg.getId());
        b.setOperationPhase("WAITING_FOR_INTAKE");
        b.setStatus("CHECKED_IN");
        return b;
    }

    private Booking automatedWashBooking(ServicePackage pkg) {
        Booking b = checkedInBooking();
        b.setServicePackageId(pkg.getId());
        b.setStatus("IN_PROGRESS");
        b.setOperationPhase("AUTOMATED_WASH");
        return b;
    }

    private Booking finalInspectionBooking(ServicePackage pkg) {
        Booking b = checkedInBooking();
        b.setServicePackageId(pkg.getId());
        b.setStatus("IN_PROGRESS");
        b.setOperationPhase("FINAL_INSPECTION");
        return b;
    }

    private BookingServiceStep pendingStep(Long bookingId, String executionPhase) {
        BookingServiceStep s = new BookingServiceStep();
        s.setId(Math.abs((executionPhase != null ? executionPhase : "null").hashCode() % 10000L));
        s.setBookingId(bookingId);
        s.setServicePackageId(10L);
        s.setStepOrder(1);
        s.setName(executionPhase != null ? executionPhase + " step" : "unclassified step");
        s.setExecutionPhase(executionPhase);
        s.setStatus("PENDING");
        return s;
    }

    private BookingServiceStep completedStep(Long bookingId, String executionPhase) {
        BookingServiceStep s = pendingStep(bookingId, executionPhase);
        s.setStatus("COMPLETED");
        s.setCompletedAt(TestFixtures.BASE_TIME);
        s.setCompletedByStaffId(staffUser.getId());
        return s;
    }

    private VehicleInspectionCreateRequest beforeWashRequest() {
        VehicleInspectionCreateRequest req = new VehicleInspectionCreateRequest();
        req.setInspectionType("BEFORE_WASH");
        req.setExteriorCondition("Clean");
        req.setInteriorCondition("Clean");
        req.setNotes("Initial check");
        req.setImagePublicIds(List.of());
        return req;
    }

    private VehicleInspection existingBeforeWash(Long bookingId) {
        VehicleInspection v = new VehicleInspection();
        v.setId(301L);
        v.setBookingId(bookingId);
        v.setType("BEFORE_WASH");
        v.setInspectedByStaffId(staffUser.getId());
        return v;
    }

    private VehicleInspection beforeWashInspection(Long bookingId) {
        VehicleInspection v = new VehicleInspection();
        v.setId(301L);
        v.setBookingId(bookingId);
        v.setType("BEFORE_WASH");
        v.setCreatedAt(TestFixtures.BASE_TIME.minusHours(3));
        v.setUpdatedAt(TestFixtures.BASE_TIME.minusHours(3));
        return v;
    }

    private VehicleInspection afterWashInspection(Long bookingId, LocalDateTime updatedAt) {
        VehicleInspection v = new VehicleInspection();
        v.setId(302L);
        v.setBookingId(bookingId);
        v.setType("AFTER_WASH");
        v.setCreatedAt(updatedAt);
        v.setUpdatedAt(updatedAt);
        return v;
    }
}
