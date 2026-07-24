package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CareAssignmentRequest;
import com.autowashpro.dto.response.AssignedCareStaffResponse;
import com.autowashpro.dto.response.AvailableCareStaffResponse;
import com.autowashpro.dto.response.CareAssignmentStatusResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.BookingAssignedStaff;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.User;
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
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
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
 * Tests for the new getAvailableCareStaff / getCareAssignmentStatus endpoints and
 * the overhauled assignCareStaff() with PESSIMISTIC_WRITE locking.
 * Covers security, availability filtering, assignment validation, and shortage status.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BookingCareAvailabilityTest {

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
            if (b.getId() == null) b.setId(99L);
            return b;
        });
        lenient().when(bookingAssignedStaffRepository.save(any(BookingAssignedStaff.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION A — SECURITY: getAvailableCareStaff
    // ══════════════════════════════════════════════════════════════════════════

    // Test A1 — VEHICLE_CARE_STAFF role → 403
    @Test
    void getAvailableCareStaff_vehicleCareStaffRole_throwsForbidden() {
        User vehicleCareUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile vehicleCareProfile = TestFixtures.careStaff(vehicleCareUser, garage);

        when(staffProfileRepository.findByUser_Id(vehicleCareUser.getId())).thenReturn(Optional.of(vehicleCareProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.getAvailableCareStaff(booking.getId(), vehicleCareUser.getId(), "ROLE_STAFF"));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // Test A2 — no staff profile (simulates customer user) → 403
    @Test
    void getAvailableCareStaff_noStaffProfile_throwsForbidden() {
        User customerUser = TestFixtures.customer();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);

        when(staffProfileRepository.findByUser_Id(customerUser.getId())).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.getAvailableCareStaff(booking.getId(), customerUser.getId(), "ROLE_STAFF"));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION B — SECURITY: getCareAssignmentStatus
    // ══════════════════════════════════════════════════════════════════════════

    // Test B1 — VEHICLE_CARE_STAFF role → 403
    @Test
    void getCareAssignmentStatus_vehicleCareStaffRole_throwsForbidden() {
        User vehicleCareUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile vehicleCareProfile = TestFixtures.careStaff(vehicleCareUser, garage);

        when(staffProfileRepository.findByUser_Id(vehicleCareUser.getId())).thenReturn(Optional.of(vehicleCareProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.getCareAssignmentStatus(booking.getId(), vehicleCareUser.getId(), "ROLE_STAFF"));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // Test B2 — no staff profile (simulates customer user) → 403
    @Test
    void getCareAssignmentStatus_noStaffProfile_throwsForbidden() {
        User customerUser = TestFixtures.customer();
        when(staffProfileRepository.findByUser_Id(customerUser.getId())).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.getCareAssignmentStatus(1L, customerUser.getId(), "ROLE_STAFF"));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION C — AVAILABILITY FILTERING
    // ══════════════════════════════════════════════════════════════════════════

    // Test C1 — getAvailableCareStaff: noCareRequirement → returns empty list
    @Test
    void getAvailableCareStaff_noCareRequirement_returnsEmpty() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = washOnlyPackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        booking.setPlannedCareStartAt(null);
        booking.setPlannedCareEndAt(null);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));

        List<AvailableCareStaffResponse> result = bookingService.getAvailableCareStaff(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertTrue(result.isEmpty());
    }

    // Test C2 — getAvailableCareStaff: missing care window → 400
    @Test
    void getAvailableCareStaff_missingCareWindow_throwsBadRequest() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        booking.setPlannedCareStartAt(null);
        booking.setPlannedCareEndAt(null);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.getAvailableCareStaff(booking.getId(), actor.getId(), "ROLE_STAFF"));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().toLowerCase().contains("planned care window"));
    }

    // Test C3 — available staff list excludes staff already assigned to THIS booking (RESERVED)
    @Test
    void getAvailableCareStaff_alreadyAssignedToBooking_excluded() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackageTwoStaff();
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);
        StaffProfile careStaff1 = TestFixtures.careStaff(TestFixtures.staff(), garage);
        careStaff1.setId(10L);
        StaffProfile careStaff2 = TestFixtures.careStaff(TestFixtures.staff(), garage);
        careStaff2.setId(11L);

        // findAvailableStaff returns both (neither has overlapping assignment at other bookings)
        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingAssignedStaffRepository.findAvailableStaff(
                anyLong(), any(StaffType.class), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(careStaff1, careStaff2));
        // careStaff1 is already RESERVED for this booking
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(reservedAssignment(booking, careStaff1.getId())));

        List<AvailableCareStaffResponse> result = bookingService.getAvailableCareStaff(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        // careStaff1 is excluded; only careStaff2 remains
        assertEquals(1, result.size());
        assertEquals(careStaff2.getId(), result.get(0).getStaffProfileId());
    }

    // Test C4 — available staff list: all slots free → returns both
    @Test
    void getAvailableCareStaff_twoFreeStaff_returnsBoth() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackageTwoStaff();
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);
        StaffProfile cs1 = TestFixtures.careStaff(TestFixtures.staff(), garage);
        cs1.setId(10L);
        StaffProfile cs2 = TestFixtures.careStaff(TestFixtures.staff(), garage);
        cs2.setId(11L);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingAssignedStaffRepository.findAvailableStaff(
                anyLong(), any(StaffType.class), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(cs1, cs2));

        List<AvailableCareStaffResponse> result = bookingService.getAvailableCareStaff(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertEquals(2, result.size());
    }

    // Test C5 — RELEASED assignment does not block staff availability (excluded by findAvailableStaff query)
    @Test
    void getAvailableCareStaff_releasedAssignment_doesNotBlockStaff() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);
        StaffProfile careStaff = TestFixtures.careStaff(TestFixtures.staff(), garage);
        careStaff.setId(10L);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        // findAvailableStaff already excludes RELEASED from "busy" — careStaff is returned as available
        when(bookingAssignedStaffRepository.findAvailableStaff(
                anyLong(), any(StaffType.class), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(careStaff));

        List<AvailableCareStaffResponse> result = bookingService.getAvailableCareStaff(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertEquals(1, result.size());
        assertEquals(careStaff.getId(), result.get(0).getStaffProfileId());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION D — ASSIGNMENT VALIDATION (assignCareStaff)
    // ══════════════════════════════════════════════════════════════════════════

    // Test D1 — no care requirement in packages → 400
    @Test
    void assignCareStaff_noCarePackage_throwsBadRequest() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = washOnlyPackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        booking.setPlannedCareStartAt(null);
        booking.setPlannedCareEndAt(null);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(10L);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), actor.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().toLowerCase().contains("not require"));
    }

    // Test D2 — null plannedCareStartAt → 400
    @Test
    void assignCareStaff_missingCareWindow_throwsBadRequest() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        booking.setPlannedCareStartAt(null);
        booking.setPlannedCareEndAt(null);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(10L);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), actor.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().toLowerCase().contains("planned care window"));
    }

    // Test D3 — CONFIRMED booking → assignment succeeds
    @Test
    void assignCareStaff_confirmedBooking_succeeds() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        booking.setStatus("CONFIRMED");
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);
        StaffProfile careStaff = TestFixtures.careStaff(TestFixtures.staff(), garage);
        careStaff.setId(10L);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(staffProfileRepository.findByIdWithLock(careStaff.getId())).thenReturn(Optional.of(careStaff));
        when(bookingAssignedStaffRepository.countOverlap(anyLong(), any(), any())).thenReturn(0L);

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(careStaff.getId());

        bookingService.assignCareStaff(booking.getId(), actor.getId(), "ROLE_STAFF", request);

        verify(bookingAssignedStaffRepository).save(
                org.mockito.ArgumentMatchers.argThat(a -> "RESERVED".equals(a.getStatus())
                        && careStaff.getId().equals(a.getStaffProfileId())));
    }

    // Test D4 — CHECKED_IN booking → assignment succeeds
    @Test
    void assignCareStaff_checkedInBooking_succeeds() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        booking.setStatus("CHECKED_IN");
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);
        StaffProfile careStaff = TestFixtures.careStaff(TestFixtures.staff(), garage);
        careStaff.setId(10L);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(staffProfileRepository.findByIdWithLock(careStaff.getId())).thenReturn(Optional.of(careStaff));
        when(bookingAssignedStaffRepository.countOverlap(anyLong(), any(), any())).thenReturn(0L);

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(careStaff.getId());

        bookingService.assignCareStaff(booking.getId(), actor.getId(), "ROLE_STAFF", request);

        verify(bookingAssignedStaffRepository).save(
                org.mockito.ArgumentMatchers.argThat(a -> "RESERVED".equals(a.getStatus())
                        && careStaff.getId().equals(a.getStaffProfileId())));
    }

    // Test D5 — PENDING_DEPOSIT status → rejected (not in allowed statuses)
    @Test
    void assignCareStaff_pendingDepositStatus_throwsBadRequest() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        booking.setStatus("PENDING_DEPOSIT");
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(10L);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), actor.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    // Test D6 — second of two care staff for requiredCount=2 → succeeds
    @Test
    void assignCareStaff_secondOfTwoForRequiredCount2_succeeds() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackageTwoStaff();
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);
        StaffProfile careStaff2 = TestFixtures.careStaff(TestFixtures.staff(), garage);
        careStaff2.setId(11L);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(staffProfileRepository.findByIdWithLock(careStaff2.getId())).thenReturn(Optional.of(careStaff2));
        // One RESERVED assignment already — at count=1, requiredCount=2 → still has room
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(reservedAssignment(booking, 10L)));
        when(bookingAssignedStaffRepository.countOverlap(anyLong(), any(), any())).thenReturn(0L);

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(careStaff2.getId());

        bookingService.assignCareStaff(booking.getId(), actor.getId(), "ROLE_STAFF", request);

        verify(bookingAssignedStaffRepository).save(
                org.mockito.ArgumentMatchers.argThat(a -> "RESERVED".equals(a.getStatus())
                        && careStaff2.getId().equals(a.getStaffProfileId())));
        // Existing assignment must NOT be cancelled
        verify(bookingAssignedStaffRepository, never()).save(
                org.mockito.ArgumentMatchers.argThat(a -> "CANCELED".equals(a.getStatus())));
    }

    // Test D7 — care staff from wrong garage → 400
    @Test
    void assignCareStaff_wrongGarageStaff_throwsBadRequest() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Garage otherGarage = TestFixtures.garage();
        otherGarage.setId(99L);
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);
        StaffProfile wrongGarageStaff = TestFixtures.careStaff(TestFixtures.staff(), otherGarage);
        wrongGarageStaff.setId(10L);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(staffProfileRepository.findByIdWithLock(wrongGarageStaff.getId())).thenReturn(Optional.of(wrongGarageStaff));

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(wrongGarageStaff.getId());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), actor.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().toLowerCase().contains("different garage"));
    }

    // Test D8 — inactive care staff → 400
    @Test
    void assignCareStaff_inactiveCareStaff_throwsBadRequest() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);
        StaffProfile inactiveStaff = TestFixtures.careStaff(TestFixtures.staff(), garage);
        inactiveStaff.setId(10L);
        inactiveStaff.setIsActive(false);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(staffProfileRepository.findByIdWithLock(inactiveStaff.getId())).thenReturn(Optional.of(inactiveStaff));

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(inactiveStaff.getId());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), actor.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().toLowerCase().contains("inactive"));
    }

    // Test D9 — care staff has overlap at another booking → 409
    @Test
    void assignCareStaff_staffHasOverlap_throwsConflict() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);
        StaffProfile busyStaff = TestFixtures.careStaff(TestFixtures.staff(), garage);
        busyStaff.setId(10L);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(staffProfileRepository.findByIdWithLock(busyStaff.getId())).thenReturn(Optional.of(busyStaff));
        // Staff is busy at another booking during care window
        when(bookingAssignedStaffRepository.countOverlap(anyLong(), any(), any())).thenReturn(1L);

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(busyStaff.getId());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), actor.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertTrue(ex.getReason().toLowerCase().contains("already assigned to another booking"));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION E — getCareAssignmentStatus
    // ══════════════════════════════════════════════════════════════════════════

    // Test E1 — shortage=true when assignedCount < requiredCount
    @Test
    void getCareAssignmentStatus_shortageTrue_whenAssignedLessThanRequired() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage(); // requiredCount=1
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        // No assignments
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of());

        CareAssignmentStatusResponse status = bookingService.getCareAssignmentStatus(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertNotNull(status);
        assertTrue(status.getRequiresCareStaff());
        assertEquals(1, status.getRequiredCount());
        assertEquals(0, status.getAssignedCount());
        assertTrue(status.getShortage());
    }

    // Test E2 — shortage=false when assignedCount == requiredCount
    @Test
    void getCareAssignmentStatus_shortageFalse_whenAtRequiredCount() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage(); // requiredCount=1
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(reservedAssignment(booking, 10L)));

        CareAssignmentStatusResponse status = bookingService.getCareAssignmentStatus(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertNotNull(status);
        assertEquals(1, status.getAssignedCount());
        assertFalse(status.getShortage());
    }

    // Test E3 — no care requirement → requiresCareStaff=false, shortage=false
    @Test
    void getCareAssignmentStatus_noCareRequirement_requiresCareStaffFalse() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = washOnlyPackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        booking.setPlannedCareStartAt(null);
        booking.setPlannedCareEndAt(null);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));

        CareAssignmentStatusResponse status = bookingService.getCareAssignmentStatus(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertNotNull(status);
        assertFalse(status.getRequiresCareStaff());
        assertFalse(status.getShortage());
        assertFalse(Boolean.TRUE.equals(status.getCanAssign()));
    }

    // Test E4 — canAssign=true for CONFIRMED booking with care window
    @Test
    void getCareAssignmentStatus_canAssign_trueForConfirmedWithCareWindow() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        booking.setStatus("CONFIRMED");
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));

        CareAssignmentStatusResponse status = bookingService.getCareAssignmentStatus(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertTrue(Boolean.TRUE.equals(status.getCanAssign()));
    }

    // Test E5 — canAssign=false for COMPLETED booking
    @Test
    void getCareAssignmentStatus_canAssign_falseForCompletedBooking() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        booking.setStatus("COMPLETED");
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of());

        CareAssignmentStatusResponse status = bookingService.getCareAssignmentStatus(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertFalse(Boolean.TRUE.equals(status.getCanAssign()));
    }

    // Test E6 — ADMIN bypasses requiresServiceOrAdmin check
    @Test
    void getCareAssignmentStatus_adminRole_succeeds() {
        User adminUser = TestFixtures.admin();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);

        // ADMIN — no staff profile lookup needed
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of());

        CareAssignmentStatusResponse status = bookingService.getCareAssignmentStatus(
                booking.getId(), adminUser.getId(), "ROLE_ADMIN");

        assertNotNull(status);
    }

    // Test E7 — care window dates are reflected in status response
    @Test
    void getCareAssignmentStatus_careWindowDatesInResponse() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        LocalDateTime expectedStart = TestFixtures.BASE_TIME.plusMinutes(30);
        LocalDateTime expectedEnd = TestFixtures.BASE_TIME.plusMinutes(75);
        booking.setPlannedCareStartAt(expectedStart);
        booking.setPlannedCareEndAt(expectedEnd);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));

        CareAssignmentStatusResponse status = bookingService.getCareAssignmentStatus(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertEquals(expectedStart, status.getPlannedCareStartAt());
        assertEquals(expectedEnd, status.getPlannedCareEndAt());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Helpers
    // ══════════════════════════════════════════════════════════════════════════

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

    private Booking confirmedCareBooking(Garage garage, ServicePackage pkg) {
        LocalDateTime start = TestFixtures.BASE_TIME;
        Booking b = new Booking();
        b.setId(30L);
        b.setCustomerId(1L);
        b.setVehicleId(1L);
        b.setGarageId(garage.getId());
        b.setServicePackageId(pkg.getId());
        b.setStartTime(start);
        b.setEndTime(start.plusMinutes(pkg.getDurationMinutes() != null ? pkg.getDurationMinutes() : 60));
        b.setPlannedWashStartAt(start);
        b.setPlannedWashEndAt(start.plusMinutes(30));
        b.setPlannedCareStartAt(start.plusMinutes(30));
        b.setPlannedCareEndAt(start.plusMinutes(pkg.getDurationMinutes() != null ? pkg.getDurationMinutes() : 60));
        b.setStatus("IN_PROGRESS");
        b.setOperationPhase("WAITING_FOR_CARE");
        b.setVehicleType("CAR");
        b.setPaymentStatus("UNPAID");
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

    // ═══════════════════════════════════════════════════════════════════════
    // F — getAssignedCareStaff: security, data correctness, DTO shape
    // ═══════════════════════════════════════════════════════════════════════

    @Test
    void getAssignedCareStaff_vehicleCareStaffActor_throwsForbidden() {
        User vehicleCareUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        StaffProfile vehicleCareProfile = TestFixtures.careStaff(vehicleCareUser, garage);
        when(staffProfileRepository.findByUser_Id(vehicleCareUser.getId()))
                .thenReturn(Optional.of(vehicleCareProfile));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.getAssignedCareStaff(30L, vehicleCareUser.getId(), "ROLE_STAFF"));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    void getAssignedCareStaff_cssStaffDifferentGarage_throwsForbidden() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Garage otherGarage = TestFixtures.garage();
        otherGarage.setId(99L);
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, otherGarage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.getAssignedCareStaff(booking.getId(), actor.getId(), "ROLE_STAFF"));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    void getAssignedCareStaff_adminActor_returnsEmptyListForBookingWithNoAssignments() {
        User admin = TestFixtures.admin();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of());

        List<AssignedCareStaffResponse> result = bookingService.getAssignedCareStaff(
                booking.getId(), admin.getId(), "ROLE_ADMIN");

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void getAssignedCareStaff_cssStaffSameGarage_returnsCorrectDto() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        User careUser = TestFixtures.user(10L, "Nguyen Van Care", "care@test.local", "0901000010", "STAFF");
        StaffProfile careStaff = TestFixtures.careStaff(careUser, garage);
        careStaff.setId(10L);
        careStaff.setStaffCode("CARE-TEST");

        BookingAssignedStaff assignment = reservedAssignment(booking, careStaff.getId());

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of(assignment));
        when(staffProfileRepository.findById(careStaff.getId())).thenReturn(Optional.of(careStaff));

        List<AssignedCareStaffResponse> result = bookingService.getAssignedCareStaff(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertEquals(1, result.size());
        AssignedCareStaffResponse dto = result.get(0);
        assertEquals(careStaff.getId(), dto.getStaffProfileId());
        assertEquals("Nguyen Van Care", dto.getDisplayName());
        assertEquals("CARE-TEST", dto.getStaffCode());
        assertEquals("RESERVED", dto.getAssignmentStatus());
    }

    @Test
    void getAssignedCareStaff_responseDto_containsOnlyAllowedFields() {
        var fieldNames = Arrays.stream(AssignedCareStaffResponse.class.getDeclaredFields())
                .map(java.lang.reflect.Field::getName)
                .collect(Collectors.toSet());
        assertFalse(fieldNames.contains("email"),  "AssignedCareStaffResponse must not expose email");
        assertFalse(fieldNames.contains("phone"),  "AssignedCareStaffResponse must not expose phone");
        assertFalse(fieldNames.contains("userId"), "AssignedCareStaffResponse must not expose userId");
        assertTrue(fieldNames.contains("staffProfileId"));
        assertTrue(fieldNames.contains("displayName"));
        assertTrue(fieldNames.contains("staffCode"));
        assertTrue(fieldNames.contains("assignmentStatus"));
    }

    @Test
    void getAssignedCareStaff_nonCareRoleAssignment_excluded() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        BookingAssignedStaff washBayAssignment = new BookingAssignedStaff();
        washBayAssignment.setId(100L);
        washBayAssignment.setBookingId(booking.getId());
        washBayAssignment.setStaffProfileId(99L);
        washBayAssignment.setStatus("ASSIGNED");
        washBayAssignment.setRoleInBooking("WASH_BAY_OPERATOR");

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(washBayAssignment));

        List<AssignedCareStaffResponse> result = bookingService.getAssignedCareStaff(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertTrue(result.isEmpty(), "Non-VEHICLE_CARE_STAFF assignments must be excluded from result");
    }

    @Test
    void getAssignedCareStaff_canceledAssignment_excluded() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        BookingAssignedStaff canceledAssignment = reservedAssignment(booking, 10L);
        canceledAssignment.setStatus("CANCELED");

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(canceledAssignment));

        List<AssignedCareStaffResponse> result = bookingService.getAssignedCareStaff(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertTrue(result.isEmpty(), "CANCELED assignment must not appear in assigned care staff list");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // G — Hardened canAssign & assignedCount in getCareAssignmentStatus
    // ═══════════════════════════════════════════════════════════════════════

    @Test
    void getCareAssignmentStatus_careWindowEndEqualsStart_canAssignFalse() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        booking.setStatus("CONFIRMED");
        LocalDateTime sameTime = TestFixtures.BASE_TIME.plusMinutes(30);
        booking.setPlannedCareStartAt(sameTime);
        booking.setPlannedCareEndAt(sameTime);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of());

        CareAssignmentStatusResponse status = bookingService.getCareAssignmentStatus(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertFalse(Boolean.TRUE.equals(status.getCanAssign()),
                "canAssign must be false when careEnd == careStart");
    }

    @Test
    void getCareAssignmentStatus_careWindowNullEnd_canAssignFalse() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        booking.setStatus("CONFIRMED");
        booking.setPlannedCareEndAt(null);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of());

        CareAssignmentStatusResponse status = bookingService.getCareAssignmentStatus(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertFalse(Boolean.TRUE.equals(status.getCanAssign()),
                "canAssign must be false when plannedCareEndAt is null");
    }

    @Test
    void getCareAssignmentStatus_nonVehicleCareStaffAssignment_notCountedInAssignedCount() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        BookingAssignedStaff washBayAssignment = new BookingAssignedStaff();
        washBayAssignment.setId(100L);
        washBayAssignment.setBookingId(booking.getId());
        washBayAssignment.setStaffProfileId(99L);
        washBayAssignment.setStatus("ASSIGNED");
        washBayAssignment.setRoleInBooking("WASH_BAY_OPERATOR");

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(washBayAssignment));

        CareAssignmentStatusResponse status = bookingService.getCareAssignmentStatus(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertEquals(0, status.getAssignedCount(),
                "WASH_BAY_OPERATOR assignment must not count toward care staff quota");
        assertTrue(status.getShortage(),
                "shortage must be true since no VEHICLE_CARE_STAFF assignment exists");
    }

    @Test
    void getCareAssignmentStatus_requiredCountZero_canAssignFalse() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage anomPkg = ServicePackage.builder()
                .id(5L)
                .name("Anomalous Package")
                .code("ANOM")
                .vehicleType("CAR")
                .serviceType("MAIN")
                .basePrice(new BigDecimal("100000.00"))
                .durationMinutes(60)
                .washBayDurationMinutes(30)
                .requiresWashBay(true)
                .requiresCareStaff(true)
                .careStaffType("VEHICLE_CARE_STAFF")
                .careStaffRequiredCount(0)
                .careStaffDurationMinutes(30)
                .pointsEarned(10)
                .isActive(true)
                .build();
        Booking booking = confirmedCareBooking(garage, anomPkg);
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(anomPkg.getId())).thenReturn(Optional.of(anomPkg));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of());

        CareAssignmentStatusResponse status = bookingService.getCareAssignmentStatus(
                booking.getId(), actor.getId(), "ROLE_STAFF");

        assertFalse(Boolean.TRUE.equals(status.getCanAssign()),
                "canAssign must be false when requiredCareStaffCount == 0");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // H — assignCareStaff: VEHICLE_CARE_STAFF actor is rejected
    // ═══════════════════════════════════════════════════════════════════════

    @Test
    void assignCareStaff_vehicleCareStaffActor_throwsForbidden() {
        User vehicleCareUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        StaffProfile vehicleCareProfile = TestFixtures.careStaff(vehicleCareUser, garage);
        when(staffProfileRepository.findByUser_Id(vehicleCareUser.getId()))
                .thenReturn(Optional.of(vehicleCareProfile));

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(10L);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(30L, vehicleCareUser.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // I — Concurrency: capacity filled by concurrent request → 409 CONFLICT
    // ═══════════════════════════════════════════════════════════════════════

    @Test
    void assignCareStaff_capacityAlreadyFilled_throwsConflict() {
        // Unit test: verifies the over-assignment guard using Mockito — DB already holds one
        // RESERVED VEHICLE_CARE_STAFF assignment, second call must be rejected with 409.
        // See CareAssignmentConcurrencyIT for the real concurrent transaction test.
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        booking.setStatus("CONFIRMED");
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        User careUser2 = TestFixtures.user(11L, "Care Staff Two", "care2@test.local", "0901000011", "STAFF");
        StaffProfile careStaff2 = TestFixtures.careStaff(careUser2, garage);
        careStaff2.setId(11L);

        // First concurrent request already reserved staffProfileId=10 → capacity now full
        BookingAssignedStaff existingAssignment = reservedAssignment(booking, 10L);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(staffProfileRepository.findByIdWithLock(careStaff2.getId())).thenReturn(Optional.of(careStaff2));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(existingAssignment));

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(careStaff2.getId());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), actor.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode(),
                "Must reject second assignment when capacity is already filled by a concurrent request");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // J — getStaffBookings: explicit CSS allow-list enforced at service layer
    // ═══════════════════════════════════════════════════════════════════════

    @Test
    void getStaffBookings_cssStaffActive_success() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findByGarageIdOrderByStartTimeDesc(garage.getId())).thenReturn(List.of());

        List<?> result = bookingService.getStaffBookings(actor.getId(), "ROLE_STAFF", null, null);

        assertNotNull(result);
    }

    @Test
    void getStaffBookings_vehicleCareStaffRole_throwsForbidden() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        StaffProfile careProfile = TestFixtures.careStaff(actor, garage);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(careProfile));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.getStaffBookings(actor.getId(), "ROLE_STAFF", null, null));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    void getStaffBookings_serviceAdvisorRole_throwsForbidden() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        StaffProfile advisorProfile = new StaffProfile();
        advisorProfile.setId(5L);
        advisorProfile.setUser(actor);
        advisorProfile.setGarageId(garage.getId());
        advisorProfile.setStaffCode("ADV-001");
        advisorProfile.setStaffType(StaffType.SERVICE_ADVISOR);
        advisorProfile.setIsActive(true);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(advisorProfile));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.getStaffBookings(actor.getId(), "ROLE_STAFF", null, null));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    void getStaffBookings_managerRole_throwsForbidden() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        StaffProfile managerProfile = new StaffProfile();
        managerProfile.setId(6L);
        managerProfile.setUser(actor);
        managerProfile.setGarageId(garage.getId());
        managerProfile.setStaffCode("MGR-001");
        managerProfile.setStaffType(StaffType.MANAGER);
        managerProfile.setIsActive(true);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(managerProfile));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.getStaffBookings(actor.getId(), "ROLE_STAFF", null, null));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    void getStaffBookings_inactiveCssStaff_throwsForbidden() {
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        StaffProfile inactiveProfile = TestFixtures.customerServiceStaff(actor, garage);
        inactiveProfile.setIsActive(false);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(inactiveProfile));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.getStaffBookings(actor.getId(), "ROLE_STAFF", null, null));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // K — currentCount uses isActiveCareAssignment helper (roleInBooking filter)
    // ═══════════════════════════════════════════════════════════════════════

    @Test
    void assignCareStaff_nonCareRoleAssignment_doesNotInflateCurrentCount() {
        // A WASH_BAY_OPERATOR ASSIGNED entry must NOT be counted toward care capacity.
        // requiredCount=1: assign should succeed even though a non-care assignment exists.
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        booking.setStatus("CONFIRMED");
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        User careUser = TestFixtures.user(12L, "Care Staff Twelve", "care12@test.local", "0901000012", "STAFF");
        StaffProfile careStaff = TestFixtures.careStaff(careUser, garage);
        careStaff.setId(12L);

        BookingAssignedStaff washBayEntry = new BookingAssignedStaff();
        washBayEntry.setId(200L);
        washBayEntry.setBookingId(booking.getId());
        washBayEntry.setStaffProfileId(99L);
        washBayEntry.setStatus("ASSIGNED");
        washBayEntry.setRoleInBooking("WASH_BAY_OPERATOR");
        washBayEntry.setAssignedFrom(booking.getPlannedCareStartAt());
        washBayEntry.setAssignedTo(booking.getPlannedCareEndAt());

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(staffProfileRepository.findByIdWithLock(careStaff.getId())).thenReturn(Optional.of(careStaff));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(washBayEntry));
        when(bookingAssignedStaffRepository.countOverlap(careStaff.getId(),
                booking.getPlannedCareStartAt(), booking.getPlannedCareEndAt())).thenReturn(0L);

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(careStaff.getId());

        // Must NOT throw — WASH_BAY_OPERATOR must not be counted as care staff
        assertDoesNotThrow(
                () -> bookingService.assignCareStaff(booking.getId(), actor.getId(), "ROLE_STAFF", request),
                "WASH_BAY_OPERATOR assignment must not block a VEHICLE_CARE_STAFF assignment");
    }

    @Test
    void assignCareStaff_activeCareAssignment_doesInflateCurrentCount() {
        // A VEHICLE_CARE_STAFF RESERVED entry MUST count toward capacity.
        // requiredCount=1: a second care staff assign must be rejected with 409.
        User actor = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage pkg = carePackage();
        Booking booking = confirmedCareBooking(garage, pkg);
        booking.setStatus("CONFIRMED");
        StaffProfile actorProfile = TestFixtures.customerServiceStaff(actor, garage);

        User careUser2 = TestFixtures.user(13L, "Care Staff Thirteen", "care13@test.local", "0901000013", "STAFF");
        StaffProfile careStaff2 = TestFixtures.careStaff(careUser2, garage);
        careStaff2.setId(13L);

        BookingAssignedStaff existingCareEntry = reservedAssignment(booking, 10L);

        when(staffProfileRepository.findByUser_Id(actor.getId())).thenReturn(Optional.of(actorProfile));
        when(bookingRepository.findByIdWithLock(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(staffProfileRepository.findByIdWithLock(careStaff2.getId())).thenReturn(Optional.of(careStaff2));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(existingCareEntry));

        CareAssignmentRequest request = new CareAssignmentRequest();
        request.setStaffProfileId(careStaff2.getId());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.assignCareStaff(booking.getId(), actor.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode(),
                "Existing VEHICLE_CARE_STAFF RESERVED assignment must count toward capacity and block over-assignment");
    }
}
