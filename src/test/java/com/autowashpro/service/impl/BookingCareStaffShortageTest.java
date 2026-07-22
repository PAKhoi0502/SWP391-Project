package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CareAssignmentRequest;
import com.autowashpro.dto.request.OperationPhaseRequest;
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for care staff shortage detection, assignCareStaff validation, and
 * the startCare gate that blocks when insufficient staff are reserved.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BookingCareStaffShortageTest {

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
    @Mock private PackageResourceResolver packageResourceResolver;

    @InjectMocks
    private BookingServiceImpl bookingService;

    @BeforeEach
    void setUp() {
        lenient().when(packageResourceResolver.resolveEffectivePackages(any()))
                .thenAnswer(inv -> List.of(inv.<ServicePackage>getArgument(0)));
        lenient().when(bookingAddOnServicePackageRepository.findByBookingIdOrderBySortOrderAsc(anyLong()))
                .thenReturn(List.of());
        lenient().when(bookingAssignedStaffRepository.findByBookingId(anyLong()))
                .thenReturn(List.of());
        lenient().when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> {
            Booking b = inv.getArgument(0);
            if (b.getId() == null) b.setId(50L);
            return b;
        });
        lenient().when(bookingAssignedStaffRepository.save(any(BookingAssignedStaff.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 1 — startCare blocked when no RESERVED assignments (shortage)
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void startCareBlockedWhenNoReservedAssignments() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage(); // requiresCareStaff=true, requiredCount=1
        Booking booking = waitingForCareBooking(garage, pkg);
        StaffProfile profile = TestFixtures.customerServiceStaff(staffUser, garage);

        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(profile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        // No assignments at all
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.startCare(booking.getId(), staffUser.getId(), "ROLE_STAFF",
                        new OperationPhaseRequest()));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertTrue(ex.getReason().toLowerCase().contains("insufficient"));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 2 — startCare succeeds when required care staff count is reserved
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void startCareSucceedsWhenRequiredStaffReserved() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage(); // requiredCount=1
        Booking booking = waitingForCareBooking(garage, pkg);
        StaffProfile profile = TestFixtures.customerServiceStaff(staffUser, garage);

        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(profile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        // One RESERVED assignment satisfies the required count
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(reservedAssignment(booking, 10L)));

        BookingResponse response = bookingService.startCare(booking.getId(), staffUser.getId(),
                "ROLE_STAFF", new OperationPhaseRequest());

        assertEquals("VEHICLE_CARE", response.getOperationPhase());
        assertNotNull(response.getCareStartedAt());
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 3 — assignCareStaff rejects CUSTOMER_SERVICE_STAFF type
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void assignCareStaffRejectsWrongStaffType() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = waitingForCareBooking(garage, pkg);
        StaffProfile actor = TestFixtures.customerServiceStaff(staffUser, garage);
        // Target staff is CUSTOMER_SERVICE_STAFF, not VEHICLE_CARE_STAFF
        StaffProfile wrongType = TestFixtures.customerServiceStaff(TestFixtures.staff(), garage);
        wrongType.setId(99L);

        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(actor));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(staffProfileRepository.findByIdWithLock(wrongType.getId())).thenReturn(Optional.of(wrongType));

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(wrongType.getId());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), staffUser.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().toLowerCase().contains("vehicle_care_staff"));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 4 — assignCareStaff rejects when booking already has required count
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void assignCareStaffRejectsWhenAlreadyAtRequiredCount() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage(); // requiredCount=1
        Booking booking = waitingForCareBooking(garage, pkg);
        StaffProfile actor = TestFixtures.customerServiceStaff(staffUser, garage);
        StaffProfile newCareStaff = TestFixtures.careStaff(TestFixtures.staff(), garage);
        newCareStaff.setId(20L);

        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(actor));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(staffProfileRepository.findByIdWithLock(newCareStaff.getId())).thenReturn(Optional.of(newCareStaff));
        // Already have 1 RESERVED assignment — at the required count
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(reservedAssignment(booking, 10L)));

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(newCareStaff.getId());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), staffUser.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertTrue(ex.getReason().toLowerCase().contains("already has"));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 5 — assignCareStaff rejects assigning the same staff member twice
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void assignCareStaffRejectsDuplicateAssignment() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        // Use a package that requires 2 staff so we don't hit the "already at capacity" guard first
        ServicePackage pkg = carePackageTwoStaff();
        Booking booking = waitingForCareBooking(garage, pkg);
        StaffProfile actor = TestFixtures.customerServiceStaff(staffUser, garage);
        StaffProfile careStaff = TestFixtures.careStaff(TestFixtures.staff(), garage);
        careStaff.setId(10L);

        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(actor));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(staffProfileRepository.findByIdWithLock(careStaff.getId())).thenReturn(Optional.of(careStaff));
        // Staff 10L is already RESERVED for this booking
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(reservedAssignment(booking, 10L)));

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(careStaff.getId());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), staffUser.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertTrue(ex.getReason().toLowerCase().contains("already assigned"));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 6 — assignCareStaff adds without cancelling existing valid assignments
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void assignCareStaffAddsWithoutCancellingExistingAssignments() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackageTwoStaff(); // requires 2 care staff
        Booking booking = waitingForCareBooking(garage, pkg);
        StaffProfile actor = TestFixtures.customerServiceStaff(staffUser, garage);
        StaffProfile existingCareStaff = TestFixtures.careStaff(TestFixtures.staff(), garage);
        existingCareStaff.setId(10L);
        StaffProfile newCareStaff = TestFixtures.careStaff(TestFixtures.staff(), garage);
        newCareStaff.setId(11L);

        BookingAssignedStaff existingAssignment = reservedAssignment(booking, existingCareStaff.getId());

        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(actor));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(staffProfileRepository.findByIdWithLock(newCareStaff.getId())).thenReturn(Optional.of(newCareStaff));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(existingAssignment));
        when(bookingAssignedStaffRepository.countOverlap(anyLong(), any(), any())).thenReturn(0L);

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(newCareStaff.getId());

        bookingService.assignCareStaff(booking.getId(), staffUser.getId(), "ROLE_STAFF", request);

        // Existing assignment must NOT be cancelled
        verify(bookingAssignedStaffRepository, never()).save(
                org.mockito.ArgumentMatchers.argThat(a -> "CANCELED".equals(a.getStatus())
                        && existingCareStaff.getId().equals(a.getStaffProfileId())));
        // New assignment must be saved as RESERVED
        verify(bookingAssignedStaffRepository).save(
                org.mockito.ArgumentMatchers.argThat(a -> "RESERVED".equals(a.getStatus())
                        && newCareStaff.getId().equals(a.getStaffProfileId())));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 7 — assignCareStaff rejects COMPLETED booking
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void assignCareStaffRejectsCompletedBooking() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = waitingForCareBooking(garage, pkg);
        booking.setStatus("COMPLETED");
        StaffProfile actor = TestFixtures.customerServiceStaff(staffUser, garage);

        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(actor));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(10L);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), staffUser.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 8 — assignCareStaff rejects booking whose packages don't require care
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void assignCareStaffRejectsBookingWithNoCareRequirement() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        // Package with NO care requirement
        ServicePackage pkg = washOnlyPackage();
        Booking booking = waitingForCareBooking(garage, pkg);
        booking.setPlannedCareStartAt(null);
        booking.setPlannedCareEndAt(null);
        booking.setOperationPhase("AUTOMATED_WASH");
        booking.setStatus("IN_PROGRESS");
        StaffProfile actor = TestFixtures.customerServiceStaff(staffUser, garage);

        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(actor));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(10L);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), staffUser.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().toLowerCase().contains("not require"));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 9 — careStaffShortage is false for bookings not in WAITING_FOR_CARE
    //           (verifies N+1 optimization: no package queries for other phases)
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void careStaffShortageIsFalseForNonWaitingForCarePhase() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        // Booking in VEHICLE_CARE phase (past the WAITING_FOR_CARE gate)
        Booking booking = waitingForCareBooking(garage, pkg);
        booking.setOperationPhase("VEHICLE_CARE");
        StaffProfile profile = TestFixtures.customerServiceStaff(staffUser, garage);

        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(profile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        // completeCare returns toResponse(booking) → resolveCareStaffShortage is called
        // For VEHICLE_CARE phase, it should return false immediately without touching packages
        // Mock a ACTIVE assignment so completeCare can proceed
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(activeAssignment(booking, 10L)));
        BookingServiceStep careStep = new BookingServiceStep();
        careStep.setBookingId(booking.getId());
        careStep.setName("Care step");
        careStep.setExecutionPhase("VEHICLE_CARE");
        careStep.setStatus("COMPLETED");
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(careStep));

        BookingResponse response = bookingService.completeCare(booking.getId(),
                staffUser.getId(), "ROLE_STAFF", new OperationPhaseRequest());

        assertEquals("FINAL_INSPECTION", response.getOperationPhase());
        // For VEHICLE_CARE phase (not WAITING_FOR_CARE), shortage must be false
        assertFalse(Boolean.TRUE.equals(response.getCareStaffShortage()));
        // Package repository should NOT be called for shortage computation (N+1 guard)
        verify(servicePackageRepository, never()).findById(anyLong());
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────────────

    private ServicePackage carePackage() {
        return ServicePackage.builder()
                .id(2L)
                .name("Full Wash + Care")
                .code("CAR-FULL")
                .vehicleType("CAR")
                .serviceType("MAIN")
                .basePrice(new BigDecimal("200000.00"))
                .durationMinutes(90)
                .washBayDurationMinutes(30)
                .requiresWashBay(true)
                .requiresCareStaff(true)
                .careStaffType("VEHICLE_CARE_STAFF")
                .careStaffRequiredCount(1)
                .careStaffDurationMinutes(45)
                .pointsEarned(20)
                .isActive(true)
                .build();
    }

    private ServicePackage carePackageTwoStaff() {
        return ServicePackage.builder()
                .id(3L)
                .name("Premium Wash + Care")
                .code("CAR-PREMIUM")
                .vehicleType("CAR")
                .serviceType("MAIN")
                .basePrice(new BigDecimal("350000.00"))
                .durationMinutes(120)
                .washBayDurationMinutes(30)
                .requiresWashBay(true)
                .requiresCareStaff(true)
                .careStaffType("VEHICLE_CARE_STAFF")
                .careStaffRequiredCount(2)
                .careStaffDurationMinutes(60)
                .pointsEarned(35)
                .isActive(true)
                .build();
    }

    private ServicePackage washOnlyPackage() {
        return ServicePackage.builder()
                .id(4L)
                .name("Wash Only")
                .code("CAR-WASH-ONLY")
                .vehicleType("CAR")
                .serviceType("MAIN")
                .basePrice(new BigDecimal("80000.00"))
                .durationMinutes(30)
                .washBayDurationMinutes(30)
                .requiresWashBay(true)
                .requiresCareStaff(false)
                .pointsEarned(10)
                .isActive(true)
                .build();
    }

    private Booking waitingForCareBooking(Garage garage, ServicePackage pkg) {
        LocalDateTime start = TestFixtures.BASE_TIME;
        Booking b = new Booking();
        b.setId(30L);
        b.setCustomerId(1L);
        b.setVehicleId(1L);
        b.setGarageId(garage.getId());
        b.setServicePackageId(pkg.getId());
        b.setStartTime(start);
        b.setEndTime(start.plusMinutes(pkg.getDurationMinutes()));
        b.setPlannedWashStartAt(start);
        b.setPlannedWashEndAt(start.plusMinutes(pkg.getWashBayDurationMinutes() != null ? pkg.getWashBayDurationMinutes() : 30));
        b.setPlannedCareStartAt(b.getPlannedWashEndAt());
        b.setPlannedCareEndAt(start.plusMinutes(pkg.getDurationMinutes()));
        b.setStatus("IN_PROGRESS");
        b.setOperationPhase("WAITING_FOR_CARE");
        b.setVehicleType("CAR");
        b.setPaymentStatus("PAID");
        b.setOriginalPrice(pkg.getBasePrice());
        b.setSurchargeAmount(BigDecimal.ZERO);
        b.setDiscountAmount(BigDecimal.ZERO);
        b.setPromotionDiscountAmount(BigDecimal.ZERO);
        b.setFinalPrice(pkg.getBasePrice());
        b.setDepositAmount(BigDecimal.ZERO);
        b.setDepositStatus("NOT_REQUIRED");
        b.setRefundAmount(BigDecimal.ZERO);
        b.setIsWalkIn(true);
        b.setRewardProcessed(false);
        b.setUsedPoints(0);
        return b;
    }

    private BookingAssignedStaff reservedAssignment(Booking booking, Long staffProfileId) {
        BookingAssignedStaff a = new BookingAssignedStaff();
        a.setId(staffProfileId * 10);
        a.setBookingId(booking.getId());
        a.setStaffProfileId(staffProfileId);
        a.setAssignedFrom(booking.getPlannedCareStartAt());
        a.setAssignedTo(booking.getPlannedCareEndAt());
        a.setRoleInBooking("VEHICLE_CARE_STAFF");
        a.setStatus("RESERVED");
        return a;
    }

    private BookingAssignedStaff activeAssignment(Booking booking, Long staffProfileId) {
        BookingAssignedStaff a = reservedAssignment(booking, staffProfileId);
        a.setStatus("ACTIVE");
        return a;
    }
}
