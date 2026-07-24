package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CompleteBookingServiceStepRequest;
import com.autowashpro.dto.request.WalkInBookingCreateRequest;
import com.autowashpro.dto.response.BookingResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.BookingAssignedStaff;
import com.autowashpro.entity.BookingServiceStep;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.entity.VehicleInspection;
import com.autowashpro.entity.WashBay;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.entity.enums.WashBayStatus;
import com.autowashpro.repository.BookingAddOnServicePackageRepository;
import com.autowashpro.repository.BookingAssignedStaffRepository;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.BookingServiceStepRepository;
import com.autowashpro.repository.CustomerLoyaltyRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.GarageServicePackageRepository;
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
import org.mockito.ArgumentCaptor;
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

/**
 * Tests for the automated-wash + vehicle-care operation-phase workflow.
 * Covers phase transitions, staff reservation, overlap-window corrections, and
 * the CANCELED status for released staff on cancel/no-show.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BookingOperationPhaseTest {

    @Mock private GarageRepository garageRepository;
    @Mock private GarageServicePackageRepository garageServicePackageRepository;
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

    @BeforeEach
    void setUp() {
        lenient().when(garageServicePackageRepository
                .existsByGarageIdAndServicePackageIdAndIsActiveTrue(anyLong(), anyLong())).thenReturn(true);
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
        lenient().when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> {
            Booking b = inv.getArgument(0);
            if (b.getId() == null) b.setId(10L);
            return b;
        });
        lenient().when(bookingAssignedStaffRepository.save(any(BookingAssignedStaff.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 1 – checkIn sets operationPhase = WAITING_FOR_INTAKE
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void checkInSetsOperationPhaseToWaitingForIntake() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        Booking booking = confirmedBooking(vehicle, garage);
        StaffProfile profile = TestFixtures.customerServiceStaff(staffUser, garage);
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(profile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(vehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));

        BookingResponse response = bookingService.checkInBooking(booking.getId(), staffUser.getId(), "ROLE_STAFF", null);

        assertEquals("CHECKED_IN", response.getStatus());
        assertEquals("WAITING_FOR_INTAKE", response.getOperationPhase());
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 2 – startWash transitions to AUTOMATED_WASH
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void startWashTransitionsToAutomatedWash() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = washOnlyPackage();
        Booking booking = checkedInBooking(garage, pkg);
        WashBay washBay = TestFixtures.washBay(garage);
        StaffProfile profile = TestFixtures.customerServiceStaff(staffUser, garage);
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(profile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .thenReturn(List.of(inspection("BEFORE_WASH")));
        when(washBayRepository.findFirstByGarageIdAndVehicleTypeAndStatusAndIsActiveTrue(
                garage.getId(), "CAR", WashBayStatus.AVAILABLE)).thenReturn(Optional.of(washBay));
        when(washBayRepository.save(any(WashBay.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId())).thenReturn(List.of());
        when(comboStepResolver.resolveSteps(pkg)).thenReturn(List.of());

        BookingResponse response = bookingService.startWash(booking.getId(), staffUser.getId(), "ROLE_STAFF", null);

        assertEquals("IN_PROGRESS", response.getStatus());
        assertEquals("AUTOMATED_WASH", response.getOperationPhase());
        assertNotNull(response.getWashBayId());
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 3 – startWash rejects booking not in WAITING_FOR_INTAKE phase
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void startWashRejectsWrongOperationPhase() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = washOnlyPackage();
        Booking booking = checkedInBooking(garage, pkg);
        booking.setOperationPhase("AUTOMATED_WASH"); // already in wrong phase
        StaffProfile profile = TestFixtures.customerServiceStaff(staffUser, garage);
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(profile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .thenReturn(List.of(inspection("BEFORE_WASH")));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.startWash(booking.getId(), staffUser.getId(), "ROLE_STAFF", null));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 4 – completeWash with care package transitions to WAITING_FOR_CARE
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void completeWashWithCarePackageTransitionsToWaitingForCare() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = inProgressBooking(garage, pkg);
        booking.setOperationPhase("AUTOMATED_WASH");
        StaffProfile profile = TestFixtures.customerServiceStaff(staffUser, garage);
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(profile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        BookingServiceStep washStep = buildStep(booking, "AUTOMATED_WASH");
        washStep.setStatus("COMPLETED");
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(washStep));

        BookingResponse response = bookingService.completeWash(booking.getId(), staffUser.getId(), "ROLE_STAFF", null);

        assertEquals("WAITING_FOR_CARE", response.getOperationPhase());
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 5 – completeWash without care package transitions to FINAL_INSPECTION
    //          (no-care bookings must go through completeFinalInspection before handover)
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void completeWashWithoutCarePackageTransitionsToFinalInspection() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = washOnlyPackage();
        Booking booking = inProgressBooking(garage, pkg);
        booking.setOperationPhase("AUTOMATED_WASH");
        StaffProfile profile = TestFixtures.customerServiceStaff(staffUser, garage);
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(profile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        BookingServiceStep washStep = buildStep(booking, "AUTOMATED_WASH");
        washStep.setStatus("COMPLETED");
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(washStep));

        BookingResponse response = bookingService.completeWash(booking.getId(), staffUser.getId(), "ROLE_STAFF", null);

        assertEquals("FINAL_INSPECTION", response.getOperationPhase());
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 6 – startCare activates RESERVED assignments and transitions to VEHICLE_CARE
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void startCareActivatesReservedAssignmentAndTransitionsToVehicleCare() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = inProgressBooking(garage, pkg);
        booking.setOperationPhase("WAITING_FOR_CARE");
        StaffProfile profile = TestFixtures.customerServiceStaff(staffUser, garage);
        BookingAssignedStaff reservation = reservedAssignment(booking);
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(profile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of(reservation));

        BookingResponse response = bookingService.startCare(booking.getId(), staffUser.getId(), "ROLE_STAFF", null);

        assertEquals("VEHICLE_CARE", response.getOperationPhase());
        assertEquals("ACTIVE", reservation.getStatus());
        verify(bookingAssignedStaffRepository).save(reservation);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 7 – completeCare transitions to FINAL_INSPECTION and releases ACTIVE staff
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void completeCareTransitionsToFinalInspectionAndReleasesActiveStaff() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = inProgressBooking(garage, pkg);
        booking.setOperationPhase("VEHICLE_CARE");
        StaffProfile profile = TestFixtures.customerServiceStaff(staffUser, garage);
        BookingAssignedStaff activeAssignment = reservedAssignment(booking);
        activeAssignment.setStatus("ACTIVE");
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(profile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of(activeAssignment));
        BookingServiceStep careStep = buildStep(booking, "VEHICLE_CARE");
        careStep.setStatus("COMPLETED");
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(careStep));

        BookingResponse response = bookingService.completeCare(booking.getId(), staffUser.getId(), "ROLE_STAFF", null);

        assertEquals("FINAL_INSPECTION", response.getOperationPhase());
        assertEquals("RELEASED", activeAssignment.getStatus());
        verify(bookingAssignedStaffRepository).save(activeAssignment);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 8 – completeService sets operationPhase = DONE
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void completeServiceSetsPhaseToDone() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        Booking booking = inProgressBooking(garage, washOnlyPackage());
        // completeService requires READY_FOR_HANDOVER (no-care path) — AUTOMATED_WASH is not completeable
        booking.setOperationPhase("READY_FOR_HANDOVER");
        StaffProfile profile = TestFixtures.careStaff(staffUser, garage); // any active staff in same garage
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(profile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .thenReturn(List.of(inspection("BEFORE_WASH")));
        when(vehicleRepository.findById(anyLong())).thenReturn(Optional.of(vehicle));

        BookingResponse response = bookingService.completeService(booking.getId(), staffUser.getId(), "ROLE_STAFF", null);

        assertEquals("COMPLETED", response.getStatus());
        assertEquals("DONE", response.getOperationPhase());
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 9 – cancelBooking sets staff status to CANCELED (not RELEASED)
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void cancelBookingSetsAssignedStaffToCanceled() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        Booking booking = confirmedBooking(vehicle, garage);
        StaffProfile profile = TestFixtures.careStaff(staffUser, garage);
        BookingAssignedStaff assignment = reservedAssignment(booking);
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(profile));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of(assignment));
        when(vehicleRepository.findById(anyLong())).thenReturn(Optional.of(vehicle));
        when(userRepository.findById(booking.getCustomerId())).thenReturn(Optional.of(bankReadyCustomer(booking.getCustomerId())));

        bookingService.cancelBooking(booking.getId(), staffUser.getId(), "ROLE_STAFF", "test");

        assertEquals("CANCELED", assignment.getStatus());
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 10 – markNoShow sets staff status to CANCELED (not RELEASED)
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void noShowSetsAssignedStaffToCanceled() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        Booking booking = confirmedBooking(vehicle, garage);
        StaffProfile profile = TestFixtures.careStaff(staffUser, garage);
        BookingAssignedStaff assignment = reservedAssignment(booking);
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(profile));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of(assignment));
        when(vehicleRepository.findById(anyLong())).thenReturn(Optional.of(vehicle));

        bookingService.markNoShow(booking.getId(), staffUser.getId(), "ROLE_ADMIN", "no arrival");

        assertEquals("CANCELED", assignment.getStatus());
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 11 – walk-in CONFIRMED booking with care package reserves a care assignment
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void walkInBookingWithCarePackageReservesCareStaffOnConfirm() {
        User staffUser = TestFixtures.staff();
        User careUser = TestFixtures.user(4L, "Care", "care@test.local", "0901000004", "STAFF");
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        StaffProfile cssProfile = TestFixtures.customerServiceStaff(staffUser, garage);
        StaffProfile careProfile = TestFixtures.careStaff(careUser, garage);
        WalkInBookingCreateRequest request = walkInRequest(garage, pkg);

        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(cssProfile));
        when(garageRepository.findById(garage.getId())).thenReturn(Optional.of(garage));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(washBayRepository.findDistinctVehicleTypesByGarageId(garage.getId())).thenReturn(List.of("CAR"));
        when(bookingRepository.countOverlappingBookingsByLicensePlateAndVehicleType(any(), any(), any(), any(), any())).thenReturn(0L);
        when(washBayRepository.countActiveByGarageAndVehicleType(garage.getId(), "CAR")).thenReturn(2L);
        when(bookingRepository.countOverlappingBookingsByGarageAndVehicleType(any(), any(), any(), any(), any())).thenReturn(0L);
        when(staffProfileRepository.countByGarageIdAndStaffTypeAndIsActiveTrue(
                garage.getId(), StaffType.VEHICLE_CARE_STAFF)).thenReturn(1L);
        when(bookingAssignedStaffRepository.countAssignedStaffByGarageAndTypeAndTime(
                eq(garage.getId()), eq(StaffType.VEHICLE_CARE_STAFF), any(), any())).thenReturn(0L);
        when(userRepository.findByPhone(any())).thenReturn(Optional.empty());
        // For reserveCareStaff: findAvailableStaff returns the care profile
        when(bookingAssignedStaffRepository.findAvailableStaff(
                eq(garage.getId()), eq(StaffType.VEHICLE_CARE_STAFF), any(), any()))
                .thenReturn(List.of(careProfile));

        bookingService.createWalkInBooking(request, staffUser.getId(), "ROLE_ADMIN");

        ArgumentCaptor<BookingAssignedStaff> captor = ArgumentCaptor.forClass(BookingAssignedStaff.class);
        verify(bookingAssignedStaffRepository).save(captor.capture());
        BookingAssignedStaff reserved = captor.getValue();
        assertEquals("RESERVED", reserved.getStatus());
        assertEquals(careProfile.getId(), reserved.getStaffProfileId());
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 12 – walk-in booking without care package does NOT reserve any staff
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void walkInBookingWithoutCarePackageDoesNotReserveStaff() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = washOnlyPackage();
        StaffProfile cssProfile = TestFixtures.customerServiceStaff(staffUser, garage);
        WalkInBookingCreateRequest request = walkInRequest(garage, pkg);

        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(cssProfile));
        when(garageRepository.findById(garage.getId())).thenReturn(Optional.of(garage));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(washBayRepository.findDistinctVehicleTypesByGarageId(garage.getId())).thenReturn(List.of("CAR"));
        when(bookingRepository.countOverlappingBookingsByLicensePlateAndVehicleType(any(), any(), any(), any(), any())).thenReturn(0L);
        when(washBayRepository.countActiveByGarageAndVehicleType(garage.getId(), "CAR")).thenReturn(2L);
        when(bookingRepository.countOverlappingBookingsByGarageAndVehicleType(any(), any(), any(), any(), any())).thenReturn(0L);
        when(userRepository.findByPhone(any())).thenReturn(Optional.empty());

        bookingService.createWalkInBooking(request, staffUser.getId(), "ROLE_ADMIN");

        verify(bookingAssignedStaffRepository, never()).save(any(BookingAssignedStaff.class));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 13 – completeServiceStep rejects step whose phase doesn't match booking phase
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void completeServiceStepRejectsStepInWrongPhase() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Booking booking = inProgressBooking(garage, washOnlyPackage());
        booking.setOperationPhase("VEHICLE_CARE");
        BookingServiceStep step = buildStep(booking, "AUTOMATED_WASH");
        StaffProfile profile = TestFixtures.careStaff(staffUser, garage);
        when(bookingServiceStepRepository.findById(step.getId())).thenReturn(Optional.of(step));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(profile));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.completeServiceStep(step.getId(), staffUser.getId(),
                        "ROLE_ADMIN", new CompleteBookingServiceStepRequest()));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 14 – completeServiceStep succeeds when step phase matches booking phase
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void completeServiceStepSucceedsWhenPhaseMatches() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Booking booking = inProgressBooking(garage, washOnlyPackage());
        booking.setOperationPhase("AUTOMATED_WASH");
        BookingServiceStep step = buildStep(booking, "AUTOMATED_WASH");
        StaffProfile profile = TestFixtures.careStaff(staffUser, garage);
        when(bookingServiceStepRepository.findById(step.getId())).thenReturn(Optional.of(step));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(profile));
        when(bookingServiceStepRepository.save(any(BookingServiceStep.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = bookingService.completeServiceStep(step.getId(), staffUser.getId(),
                "ROLE_ADMIN", new CompleteBookingServiceStepRequest());

        assertEquals("COMPLETED", response.getStatus());
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test 15 – wash bay overlap check uses wash window (startTime → plannedWashEnd)
    //           not the full booking window (startTime → endTime)
    // ────────────────────────────────────────────────────────────────────────────
    @Test
    void washBayOverlapCheckUsesWashWindowNotFullBookingWindow() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        // washBayDurationMinutes=30, full durationMinutes=60
        ServicePackage pkg = washOnlyPackage(); // washBayDurationMinutes=30, durationMinutes=60
        StaffProfile cssProfile = TestFixtures.customerServiceStaff(staffUser, garage);
        WalkInBookingCreateRequest request = walkInRequest(garage, pkg);
        LocalDateTime slotStart = request.getStartTime();
        LocalDateTime expectedWashEnd = slotStart.plusMinutes(30); // wash window end

        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(cssProfile));
        when(garageRepository.findById(garage.getId())).thenReturn(Optional.of(garage));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(washBayRepository.findDistinctVehicleTypesByGarageId(garage.getId())).thenReturn(List.of("CAR"));
        when(bookingRepository.countOverlappingBookingsByLicensePlateAndVehicleType(any(), any(), any(), any(), any())).thenReturn(0L);
        when(washBayRepository.countActiveByGarageAndVehicleType(garage.getId(), "CAR")).thenReturn(2L);
        when(bookingRepository.countOverlappingBookingsByGarageAndVehicleType(any(), any(), any(), any(), any())).thenReturn(0L);
        when(userRepository.findByPhone(any())).thenReturn(Optional.empty());

        bookingService.createWalkInBooking(request, staffUser.getId(), "ROLE_ADMIN");

        // The overlap check must use the wash window end (startTime+30m), not the full booking end (startTime+60m)
        ArgumentCaptor<LocalDateTime> endCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(bookingRepository).countOverlappingBookingsByGarageAndVehicleType(
                eq(garage.getId()), eq("CAR"), eq(slotStart), endCaptor.capture(), any());
        assertEquals(expectedWashEnd, endCaptor.getValue(),
                "Wash bay overlap check should use wash window end, not full booking end");
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Helper builders
    // ────────────────────────────────────────────────────────────────────────────

    /** A wash-only package: requires wash bay (30 min), NO care staff. */
    private ServicePackage washOnlyPackage() {
        return ServicePackage.builder()
                .id(1L)
                .name("Basic Wash")
                .code("CAR-BASIC")
                .vehicleType("CAR")
                .serviceType("MAIN")
                .basePrice(new BigDecimal("120000.00"))
                .durationMinutes(60)
                .washBayDurationMinutes(30)
                .pointsEarned(10)
                .requiresWashBay(true)
                .requiresCareStaff(false)
                .careStaffRequiredCount(0)
                .careStaffDurationMinutes(0)
                .isActive(true)
                .build();
    }

    /** A package that requires a wash bay AND care staff. */
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
                .pointsEarned(20)
                .requiresWashBay(true)
                .requiresCareStaff(true)
                .careStaffType("VEHICLE_CARE_STAFF")
                .careStaffRequiredCount(1)
                .careStaffDurationMinutes(45)
                .isActive(true)
                .build();
    }

    private Booking confirmedBooking(Vehicle vehicle, Garage garage) {
        Booking b = new Booking();
        b.setId(20L);
        b.setCustomerId(vehicle.getCustomer().getId());
        b.setVehicleId(vehicle.getId());
        b.setGarageId(garage.getId());
        b.setServicePackageId(1L);
        b.setStartTime(TestFixtures.BASE_TIME);
        b.setEndTime(TestFixtures.BASE_TIME.plusMinutes(60));
        b.setStatus("CONFIRMED");
        b.setOperationPhase("WAITING_FOR_INTAKE");
        b.setPaymentStatus("UNPAID");
        b.setOriginalPrice(new BigDecimal("120000.00"));
        b.setSurchargeAmount(BigDecimal.ZERO);
        b.setDiscountAmount(BigDecimal.ZERO);
        b.setPromotionDiscountAmount(BigDecimal.ZERO);
        b.setFinalPrice(new BigDecimal("120000.00"));
        b.setDepositAmount(new BigDecimal("36000.00"));
        b.setDepositStatus("PAID");
        b.setRefundAmount(BigDecimal.ZERO);
        b.setIsWalkIn(false);
        b.setRewardProcessed(false);
        b.setUsedPoints(0);
        return b;
    }

    private Booking checkedInBooking(Garage garage, ServicePackage pkg) {
        Booking b = new Booking();
        b.setId(21L);
        b.setCustomerId(1L);
        b.setVehicleId(1L);
        b.setGarageId(garage.getId());
        b.setServicePackageId(pkg.getId());
        b.setStartTime(TestFixtures.BASE_TIME);
        b.setEndTime(TestFixtures.BASE_TIME.plusMinutes(pkg.getDurationMinutes()));
        b.setStatus("CHECKED_IN");
        b.setOperationPhase("WAITING_FOR_INTAKE");
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

    private Booking inProgressBooking(Garage garage, ServicePackage pkg) {
        Booking b = checkedInBooking(garage, pkg);
        b.setId(22L);
        b.setStatus("IN_PROGRESS");
        b.setOperationPhase("AUTOMATED_WASH");
        return b;
    }

    private BookingAssignedStaff reservedAssignment(Booking booking) {
        BookingAssignedStaff a = new BookingAssignedStaff();
        a.setId(1L);
        a.setBookingId(booking.getId());
        a.setStaffProfileId(1L);
        a.setAssignedFrom(booking.getStartTime());
        a.setAssignedTo(booking.getEndTime());
        a.setRoleInBooking("VEHICLE_CARE_STAFF");
        a.setStatus("RESERVED");
        return a;
    }

    private BookingServiceStep buildStep(Booking booking, String executionPhase) {
        BookingServiceStep step = new BookingServiceStep();
        step.setId(100L);
        step.setBookingId(booking.getId());
        step.setServicePackageId(booking.getServicePackageId());
        step.setStepOrder(1);
        step.setName("Test Step");
        step.setStatus("PENDING");
        step.setExecutionPhase(executionPhase);
        return step;
    }

    private VehicleInspection inspection(String type) {
        VehicleInspection i = new VehicleInspection();
        i.setType(type);
        return i;
    }

    private WalkInBookingCreateRequest walkInRequest(Garage garage, ServicePackage pkg) {
        WalkInBookingCreateRequest req = new WalkInBookingCreateRequest();
        req.setGarageId(garage.getId());
        req.setGuestName("Test Guest");
        req.setGuestPhone("0903000001");
        req.setLicensePlate("51H-123.45");
        req.setVehicleType("CAR");
        req.setSeatCount(5);
        req.setVehicleBrand("Toyota");
        req.setVehicleModel("Vios");
        req.setServicePackageId(pkg.getId());
        req.setStartTime(LocalDateTime.now().plusHours(1).withSecond(0).withNano(0));
        req.setPaymentMethod("CASH");
        return req;
    }

    private User bankReadyCustomer(Long id) {
        User u = TestFixtures.customer();
        u.setId(id);
        u.setBankName("VCB");
        u.setBankAccountName("Test Customer");
        u.setBankAccountNumber("123456789");
        return u;
    }
}
