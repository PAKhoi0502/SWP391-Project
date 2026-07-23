package com.autowashpro.service.impl;

import com.autowashpro.entity.Booking;
import com.autowashpro.entity.BookingAssignedStaff;
import com.autowashpro.entity.BookingServiceStep;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.User;
import com.autowashpro.entity.VehicleInspection;
import com.autowashpro.entity.WashBay;
import com.autowashpro.entity.enums.WashBayStatus;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests for the fail-closed operationPhase validation in completeService()
 * and the idempotent recoverCareWorkflow() recovery mechanism.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CompleteServicePhaseValidationTest {

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

    @BeforeEach
    void setUp() {
        garage = TestFixtures.garage();
        staffUser = TestFixtures.staff();

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

    // ── 1: no-care + READY_FOR_HANDOVER → success ───────────────────────────────

    @Test
    void noCareBooking_readyForHandover_completes() {
        ServicePackage pkg = washOnlyPackage();
        Booking booking = inProgressBooking(pkg, "READY_FOR_HANDOVER");
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .thenReturn(List.of(inspection("BEFORE_WASH")));

        var response = bookingService.completeService(booking.getId(), staffUser.getId(), "ROLE_ADMIN", null);

        assertEquals("COMPLETED", response.getStatus());
        assertEquals("DONE", response.getOperationPhase());
    }

    // ── 2: care + FINAL_INSPECTION → 409 (must call completeFinalInspection first) ──

    @Test
    void careBooking_finalInspection_blocked_returns409() {
        ServicePackage pkg = carePackage();
        Booking booking = inProgressBooking(pkg, "FINAL_INSPECTION");
        booking.setPlannedCareStartAt(LocalDateTime.now().minusHours(1));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.completeService(booking.getId(), staffUser.getId(), "ROLE_ADMIN", null));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertTrue(ex.getReason().contains("complete-final-inspection") || ex.getMessage().contains("complete-final-inspection"),
                "409 message must direct staff to call complete-final-inspection first");
        verify(bookingRepository, never()).save(argThat(b -> "COMPLETED".equals(b.getStatus())));
    }

    // ── 3: care + READY_FOR_HANDOVER + required inspections → COMPLETED ─────────

    @Test
    void careBooking_readyForHandover_withInspections_completes() {
        ServicePackage pkg = carePackage();
        Booking booking = inProgressBooking(pkg, "READY_FOR_HANDOVER");
        booking.setPlannedCareStartAt(LocalDateTime.now().minusHours(1));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .thenReturn(List.of(inspection("BEFORE_WASH"), inspection("AFTER_WASH")));

        var response = bookingService.completeService(booking.getId(), staffUser.getId(), "ROLE_ADMIN", null);

        assertEquals("COMPLETED", response.getStatus());
        assertEquals("DONE", response.getOperationPhase());
    }

    // ── 4: care + WAITING_FOR_CARE → 409 ────────────────────────────────────────

    @Test
    void careBooking_waitingForCare_blocked_returns409() {
        ServicePackage pkg = carePackage();
        Booking booking = inProgressBooking(pkg, "WAITING_FOR_CARE");
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.completeService(booking.getId(), staffUser.getId(), "ROLE_ADMIN", null));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    }

    // ── 5: care + VEHICLE_CARE → 409 ─────────────────────────────────────────────

    @Test
    void careBooking_vehicleCare_blocked_returns409() {
        ServicePackage pkg = carePackage();
        Booking booking = inProgressBooking(pkg, "VEHICLE_CARE");
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.completeService(booking.getId(), staffUser.getId(), "ROLE_ADMIN", null));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    }

    // ── 6: incomplete service step → 400 ─────────────────────────────────────────

    @Test
    void incompleteServiceStep_blocked_returns400() {
        ServicePackage pkg = washOnlyPackage();
        Booking booking = inProgressBooking(pkg, "READY_FOR_HANDOVER");
        BookingServiceStep pendingStep = new BookingServiceStep();
        pendingStep.setId(99L);
        pendingStep.setBookingId(booking.getId());
        pendingStep.setStatus("PENDING");
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()))
                .thenReturn(List.of(pendingStep));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.completeService(booking.getId(), staffUser.getId(), "ROLE_ADMIN", null));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("step") || ex.getMessage().contains("step"));
        verify(bookingRepository, never()).save(argThat(b -> "COMPLETED".equals(b.getStatus())));
    }

    // ── 7: VEHICLE_CARE_STAFF role → 403 ─────────────────────────────────────────

    @Test
    void vehicleCareStaffRole_completeService_returns403() {
        ServicePackage pkg = washOnlyPackage();
        Booking booking = inProgressBooking(pkg, "READY_FOR_HANDOVER");
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Only CUSTOMER_SERVICE_STAFF or ADMIN may perform this action"))
                .when(staffOperationAccessPolicy)
                .requireCustomerServiceOrAdminForGarage(anyLong(), any(), anyLong());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.completeService(booking.getId(), staffUser.getId(), "ROLE_STAFF", null));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // ── 8: CSS from different garage → 403 ───────────────────────────────────────

    @Test
    void cssWrongGarage_completeService_returns403() {
        ServicePackage pkg = washOnlyPackage();
        Booking booking = inProgressBooking(pkg, "READY_FOR_HANDOVER");
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Staff can only perform actions for their assigned garage"))
                .when(staffOperationAccessPolicy)
                .requireCustomerServiceOrAdminForGarage(anyLong(), any(), anyLong());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.completeService(booking.getId(), staffUser.getId(), "ROLE_STAFF", null));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // ── 9: wash bay not released when currentBookingId belongs to another booking ─

    @Test
    void washBayMismatch_doesNotReleaseOtherBookingsBay() {
        ServicePackage pkg = washOnlyPackage();
        Booking booking = inProgressBooking(pkg, "READY_FOR_HANDOVER");
        booking.setWashBayId(5L);

        WashBay washBay = TestFixtures.washBay(garage);
        washBay.setId(5L);
        washBay.setStatus(WashBayStatus.IN_USE);
        // Bay is owned by a DIFFERENT booking
        washBay.setCurrentBookingId(booking.getId() + 999L);

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));
        when(washBayRepository.findById(5L)).thenReturn(Optional.of(washBay));
        when(vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .thenReturn(List.of(inspection("BEFORE_WASH")));

        bookingService.completeService(booking.getId(), staffUser.getId(), "ROLE_ADMIN", null);

        // Bay must not be touched — status still IN_USE
        assertEquals(WashBayStatus.IN_USE, washBay.getStatus(),
                "Wash bay owned by another booking must not be released");
        verify(washBayRepository, never()).save(any(WashBay.class));
    }

    // ── 10: recoverCareWorkflow is idempotent (no duplicate assignment on 2nd call) ─

    @Test
    void recoverCareWorkflow_idempotentNoDuplicateAssignment() {
        ServicePackage pkg = carePackage();
        Booking booking = inProgressBooking(pkg, "READY_FOR_HANDOVER");
        User careUser = TestFixtures.user(4L, "Care", "care@g.io", "0900000004", "STAFF");
        StaffProfile careProfile = TestFixtures.careStaff(careUser, garage);

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(pkg.getId())).thenReturn(Optional.of(pkg));

        // Simulate already-reserved assignment (idempotency scenario)
        BookingAssignedStaff existingAssignment = new BookingAssignedStaff();
        existingAssignment.setId(1L);
        existingAssignment.setBookingId(booking.getId());
        existingAssignment.setStaffProfileId(careProfile.getId());
        existingAssignment.setRoleInBooking("VEHICLE_CARE_STAFF");
        existingAssignment.setStatus("RESERVED");
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId()))
                .thenReturn(List.of(existingAssignment));

        // Call recovery — assignment already exists → should NOT create another one
        bookingService.recoverCareWorkflow(booking.getId(), staffUser.getId(), "ROLE_ADMIN");

        // No new BookingAssignedStaff saved
        verify(bookingAssignedStaffRepository, never()).save(any(BookingAssignedStaff.class));
        // Booking phase updated to WAITING_FOR_CARE
        ArgumentCaptor<Booking> captor = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository).save(captor.capture());
        assertEquals("WAITING_FOR_CARE", captor.getValue().getOperationPhase());
    }

    // ── helpers ──────────────────────────────────────────────────────────────────

    private ServicePackage washOnlyPackage() {
        return ServicePackage.builder()
                .id(1L).name("Basic Wash").code("WASH-001")
                .vehicleType("CAR").serviceType("MAIN")
                .basePrice(new BigDecimal("120000")).durationMinutes(60)
                .washBayDurationMinutes(30).pointsEarned(10)
                .requiresWashBay(true).requiresCareStaff(false)
                .careStaffRequiredCount(0).careStaffDurationMinutes(0)
                .isActive(true).build();
    }

    private ServicePackage carePackage() {
        return ServicePackage.builder()
                .id(2L).name("Full Care").code("CARE-001")
                .vehicleType("CAR").serviceType("MAIN")
                .basePrice(new BigDecimal("200000")).durationMinutes(90)
                .washBayDurationMinutes(30).pointsEarned(20)
                .requiresWashBay(true).requiresCareStaff(true)
                .careStaffType("VEHICLE_CARE_STAFF").careStaffRequiredCount(1)
                .careStaffDurationMinutes(45).isActive(true).build();
    }

    private Booking inProgressBooking(ServicePackage pkg, String operationPhase) {
        Booking b = new Booking();
        b.setId(22L);
        b.setCustomerId(1L);
        b.setVehicleId(1L);
        b.setGarageId(garage.getId());
        b.setServicePackageId(pkg.getId());
        b.setStartTime(TestFixtures.BASE_TIME);
        b.setEndTime(TestFixtures.BASE_TIME.plusMinutes(pkg.getDurationMinutes()));
        b.setStatus("IN_PROGRESS");
        b.setOperationPhase(operationPhase);
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

    private VehicleInspection inspection(String type) {
        VehicleInspection i = new VehicleInspection();
        i.setType(type);
        return i;
    }
}
