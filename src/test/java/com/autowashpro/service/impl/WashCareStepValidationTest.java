package com.autowashpro.service.impl;

import com.autowashpro.dto.response.BookingResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.BookingAssignedStaff;
import com.autowashpro.entity.BookingServiceStep;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.User;
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
 * Mandatory tests for the validatePhaseStepsCompleted guard in completeWash and completeCare.
 *
 * Confirms:
 * - completeWash rejects (409) if any AUTOMATED_WASH step is not COMPLETED
 * - completeCare rejects (409) if any VEHICLE_CARE step is not COMPLETED
 * - Phase filtering is correct: wash steps do not block completeCare, care steps do not block completeWash
 * - No-care bookings transition to FINAL_INSPECTION (not READY_FOR_HANDOVER) after completeWash
 * - Care bookings transition to WAITING_FOR_CARE after completeWash
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WashCareStepValidationTest {

    @Mock private GarageRepository garageRepository;
    @Mock private ServicePackageRepository servicePackageRepository;
    @Mock private WashBayRepository washBayRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private VehicleRepository vehicleRepository;
    @Mock private CustomerLoyaltyRepository customerLoyaltyRepository;
    @Mock private LoyaltyTierRuleRepository loyaltyTierRuleRepository;
    @Mock private PromotionRepository promotionRepository;
    @Mock private PromotionUsageRepository promotionUsageRepository;
    @Mock private BookingAssignedStaffRepository bookingAssignedStaffRepository;
    @Mock private StaffProfileRepository staffProfileRepository;
    @Mock private UserRepository userRepository;
    @Mock private BookingServiceStepRepository bookingServiceStepRepository;
    @Mock private ServicePackageStepRepository servicePackageStepRepository;
    @Mock private VehicleInspectionRepository vehicleInspectionRepository;
    @Mock private ComboStepResolver comboStepResolver;
    @Mock private BookingAddOnServicePackageRepository bookingAddOnServicePackageRepository;
    @Mock private PointTransactionRepository pointTransactionRepository;
    @Mock private PaymentTransactionRepository paymentTransactionRepository;
    @Mock private LoyaltyService loyaltyService;
    @Mock private LoyaltyPointExpiryService loyaltyPointExpiryService;
    @Mock private WashHistoryService washHistoryService;
    @Mock private PromotionService promotionService;
    @Mock private NotificationService notificationService;
    @Mock private EmailService emailService;
    @Mock private BookingReviewService bookingReviewService;
    @Mock private StaffOperationAccessPolicy staffOperationAccessPolicy;
    @Mock private PackageResourceResolver packageResourceResolver;

    @InjectMocks
    private BookingServiceImpl bookingService;

    private User staffUser;
    private Garage garage;
    private StaffProfile staffProfile;

    @BeforeEach
    void setUp() {
        staffUser = TestFixtures.staff();
        garage = TestFixtures.garage();
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
        lenient().when(bookingAssignedStaffRepository.save(any(BookingAssignedStaff.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        lenient().when(staffProfileRepository.findByUser_Id(staffUser.getId()))
                .thenReturn(Optional.of(staffProfile));
    }

    // ── 1: completeWash with pending AUTOMATED_WASH step → 409 ──────────────────

    @Test
    void completeWash_pendingAutomatedWashStep_returns409() {
        ServicePackage pkg = washOnlyPackage();
        Booking booking = automatedWashBooking(pkg);
        BookingServiceStep pendingStep = step(booking.getId(), "AUTOMATED_WASH", "PENDING");

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(pendingStep));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.completeWash(booking.getId(), staffUser.getId(), "ROLE_STAFF", null));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        // Wash bay must NOT be released when step validation fails
        verify(washBayRepository, never()).save(any());
        // Phase must NOT change
        assertEquals("AUTOMATED_WASH", booking.getOperationPhase());
    }

    // ── 2: completeWash all AUTOMATED_WASH done, no-care → FINAL_INSPECTION ────

    @Test
    void completeWash_allAutomatedWashStepsDone_noCare_returnsFinalInspection() {
        ServicePackage pkg = washOnlyPackage();
        Booking booking = automatedWashBooking(pkg);
        BookingServiceStep done = step(booking.getId(), "AUTOMATED_WASH", "COMPLETED");

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(done));

        BookingResponse response = bookingService.completeWash(booking.getId(), staffUser.getId(), "ROLE_STAFF", null);

        assertEquals("FINAL_INSPECTION", response.getOperationPhase(),
                "No-care booking must advance to FINAL_INSPECTION, not READY_FOR_HANDOVER");
    }

    // ── 3: completeWash all AUTOMATED_WASH done, care booking → WAITING_FOR_CARE

    @Test
    void completeWash_allAutomatedWashStepsDone_care_returnsWaitingForCare() {
        ServicePackage pkg = carePackage();
        Booking booking = automatedWashBooking(pkg);
        booking.setPlannedCareStartAt(TestFixtures.BASE_TIME.plusMinutes(30));
        booking.setPlannedCareEndAt(TestFixtures.BASE_TIME.plusMinutes(75));
        BookingServiceStep done = step(booking.getId(), "AUTOMATED_WASH", "COMPLETED");

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(done));

        BookingResponse response = bookingService.completeWash(booking.getId(), staffUser.getId(), "ROLE_STAFF", null);

        assertEquals("WAITING_FOR_CARE", response.getOperationPhase());
    }

    // ── 4: completeWash with no steps at all → passes, no-care → FINAL_INSPECTION

    @Test
    void completeWash_noSteps_returns409AndKeepsBay() {
        ServicePackage pkg = washOnlyPackage();
        Booking booking = automatedWashBooking(pkg);

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.completeWash(booking.getId(), staffUser.getId(), "ROLE_STAFF", null));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertEquals("AUTOMATED_WASH", booking.getOperationPhase());
        verify(washBayRepository, never()).save(any());
    }

    // ── 5: completeCare with pending VEHICLE_CARE step → 409 ────────────────────

    @Test
    void completeCare_pendingVehicleCareStep_returns409() {
        ServicePackage pkg = carePackage();
        Booking booking = vehicleCareBooking(pkg);
        BookingServiceStep pendingStep = step(booking.getId(), "VEHICLE_CARE", "PENDING");

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(pendingStep));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.completeCare(booking.getId(), staffUser.getId(), "ROLE_STAFF", null));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        // operationPhase must NOT change
        assertEquals("VEHICLE_CARE", booking.getOperationPhase());
        // careCompletedAt must NOT be set
        assertEquals(null, booking.getCareCompletedAt());
        // No assignment must be RELEASED
        verify(bookingAssignedStaffRepository, never()).save(any());
    }

    // ── 6: completeCare all VEHICLE_CARE done → FINAL_INSPECTION, releases staff ─

    @Test
    void completeCare_allVehicleCareStepsDone_returnsFinalInspectionAndReleasesStaff() {
        ServicePackage pkg = carePackage();
        Booking booking = vehicleCareBooking(pkg);
        BookingServiceStep done = step(booking.getId(), "VEHICLE_CARE", "COMPLETED");
        BookingAssignedStaff activeAssignment = activeAssignment(booking);

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(done));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(activeAssignment));

        BookingResponse response = bookingService.completeCare(booking.getId(), staffUser.getId(), "ROLE_STAFF", null);

        assertEquals("FINAL_INSPECTION", response.getOperationPhase());
        assertEquals("RELEASED", activeAssignment.getStatus());
        verify(bookingAssignedStaffRepository).save(activeAssignment);
    }

    // ── 7: completeCare with no steps → passes → FINAL_INSPECTION ───────────────

    @Test
    void completeCare_noSteps_returns409AndKeepsAssignment() {
        ServicePackage pkg = carePackage();
        Booking booking = vehicleCareBooking(pkg);

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.completeCare(booking.getId(), staffUser.getId(), "ROLE_STAFF", null));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertEquals("VEHICLE_CARE", booking.getOperationPhase());
        assertEquals(null, booking.getCareCompletedAt());
        verify(bookingAssignedStaffRepository, never()).save(any());
    }

    // ── 8: completeCare with pending AUTOMATED_WASH step → does NOT block ────────

    @Test
    void completeCare_pendingAutomatedWashStep_doesNotBlockCompletion() {
        ServicePackage pkg = carePackage();
        Booking booking = vehicleCareBooking(pkg);
        // Only VEHICLE_CARE steps should block completeCare; a leftover wash step must not
        BookingServiceStep pendingWashStep = step(booking.getId(), "AUTOMATED_WASH", "PENDING");
        BookingServiceStep doneCarStep = step(booking.getId(), "VEHICLE_CARE", "COMPLETED");

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(pendingWashStep, doneCarStep));

        BookingResponse response = bookingService.completeCare(booking.getId(), staffUser.getId(), "ROLE_STAFF", null);

        assertEquals("FINAL_INSPECTION", response.getOperationPhase());
    }

    // ── 9: completeWash with pending VEHICLE_CARE step → does NOT block ──────────

    @Test
    void completeWash_pendingVehicleCareStep_doesNotBlockCompletion() {
        ServicePackage pkg = carePackage();
        Booking booking = automatedWashBooking(pkg);
        booking.setPlannedCareStartAt(TestFixtures.BASE_TIME.plusMinutes(30));
        booking.setPlannedCareEndAt(TestFixtures.BASE_TIME.plusMinutes(75));
        // Care step is PENDING but that must not block completeWash (care hasn't started yet)
        BookingServiceStep pendingCareStep = step(booking.getId(), "VEHICLE_CARE", "PENDING");
        BookingServiceStep doneWashStep = step(booking.getId(), "AUTOMATED_WASH", "COMPLETED");

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(pendingCareStep, doneWashStep));

        BookingResponse response = bookingService.completeWash(booking.getId(), staffUser.getId(), "ROLE_STAFF", null);

        assertEquals("WAITING_FOR_CARE", response.getOperationPhase());
    }

    // ── 10: completeWash → IN_PROGRESS step with null executionPhase does NOT block

    @Test
    void completeWash_pendingStepWithNullExecutionPhase_returns409() {
        ServicePackage pkg = washOnlyPackage();
        Booking booking = automatedWashBooking(pkg);
        // A step with null executionPhase (e.g. legacy data) must be ignored
        BookingServiceStep nullPhaseStep = step(booking.getId(), null, "PENDING");
        BookingServiceStep doneWashStep = step(booking.getId(), "AUTOMATED_WASH", "COMPLETED");

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(nullPhaseStep, doneWashStep));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.completeWash(booking.getId(), staffUser.getId(), "ROLE_STAFF", null));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertEquals("AUTOMATED_WASH", booking.getOperationPhase());
        verify(washBayRepository, never()).save(any());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private ServicePackage washOnlyPackage() {
        return ServicePackage.builder()
                .id(1L).name("Basic Wash").code("WASH-BASIC")
                .vehicleType("CAR").serviceType("MAIN")
                .basePrice(new BigDecimal("100000.00"))
                .durationMinutes(60).washBayDurationMinutes(30)
                .requiresWashBay(true).requiresCareStaff(false)
                .careStaffRequiredCount(0).careStaffDurationMinutes(0)
                .isActive(true).build();
    }

    private ServicePackage carePackage() {
        return ServicePackage.builder()
                .id(2L).name("Full Wash + Care").code("CAR-FULL")
                .vehicleType("CAR").serviceType("MAIN")
                .basePrice(new BigDecimal("200000.00"))
                .durationMinutes(90).washBayDurationMinutes(30)
                .requiresWashBay(true).requiresCareStaff(true)
                .careStaffType("VEHICLE_CARE_STAFF")
                .careStaffRequiredCount(1).careStaffDurationMinutes(45)
                .isActive(true).build();
    }

    private Booking automatedWashBooking(ServicePackage pkg) {
        Booking b = new Booking();
        b.setId(50L);
        b.setCustomerId(1L);
        b.setVehicleId(1L);
        b.setGarageId(garage.getId());
        b.setServicePackageId(pkg.getId());
        b.setStartTime(TestFixtures.BASE_TIME);
        b.setEndTime(TestFixtures.BASE_TIME.plusMinutes(pkg.getDurationMinutes()));
        b.setStatus("IN_PROGRESS");
        b.setOperationPhase("AUTOMATED_WASH");
        b.setVehicleType("CAR");
        b.setPaymentStatus("UNPAID");
        b.setOriginalPrice(pkg.getBasePrice());
        b.setSurchargeAmount(BigDecimal.ZERO);
        b.setDiscountAmount(BigDecimal.ZERO);
        b.setPromotionDiscountAmount(BigDecimal.ZERO);
        b.setFinalPrice(pkg.getBasePrice());
        b.setDepositAmount(BigDecimal.ZERO);
        b.setDepositStatus("PAID");
        b.setRefundAmount(BigDecimal.ZERO);
        b.setIsWalkIn(false);
        b.setRewardProcessed(false);
        b.setUsedPoints(0);
        return b;
    }

    private Booking vehicleCareBooking(ServicePackage pkg) {
        Booking b = automatedWashBooking(pkg);
        b.setId(51L);
        b.setOperationPhase("VEHICLE_CARE");
        return b;
    }

    private BookingServiceStep step(Long bookingId, String executionPhase, String status) {
        BookingServiceStep s = new BookingServiceStep();
        s.setId(100L + (executionPhase != null ? executionPhase.hashCode() : 0));
        s.setBookingId(bookingId);
        s.setServicePackageId(1L);
        s.setStepOrder(1);
        s.setName("Step");
        s.setExecutionPhase(executionPhase);
        s.setStatus(status);
        return s;
    }

    private BookingAssignedStaff activeAssignment(Booking booking) {
        BookingAssignedStaff a = new BookingAssignedStaff();
        a.setId(1L);
        a.setBookingId(booking.getId());
        a.setStaffProfileId(1L);
        a.setAssignedFrom(booking.getStartTime());
        a.setAssignedTo(booking.getEndTime());
        a.setRoleInBooking("VEHICLE_CARE_STAFF");
        a.setStatus("ACTIVE");
        return a;
    }
}
