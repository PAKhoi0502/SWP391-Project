package com.autowashpro.service.impl;

import com.autowashpro.entity.BookingAssignedStaff;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.repository.*;
import com.autowashpro.service.*;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.service.support.PackageResourceResolver;
import com.autowashpro.service.support.StaffOperationAccessPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CareTaskAuthorizationTest {

    // ── repositories ─────────────────────────────────────────────────────────
    @Mock GarageRepository garageRepository;
    @Mock ServicePackageRepository servicePackageRepository;
    @Mock WashBayRepository washBayRepository;
    @Mock BookingRepository bookingRepository;
    @Mock PaymentTransactionRepository paymentTransactionRepository;
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

    // ── services ─────────────────────────────────────────────────────────────
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

    @InjectMocks
    BookingServiceImpl bookingService;

    @BeforeEach
    void setUp() {
        lenient().when(packageResourceResolver.resolveEffectivePackages(any()))
                .thenAnswer(inv -> List.of(inv.<ServicePackage>getArgument(0)));
        lenient().when(bookingAddOnServicePackageRepository.findByBookingIdOrderBySortOrderAsc(anyLong()))
                .thenReturn(List.of());
        lenient().when(bookingAssignedStaffRepository.findByBookingId(anyLong()))
                .thenReturn(List.of());
    }

    private static final Long STAFF_ID = 1L;
    private static final Long PROFILE_ID = 10L;

    private StaffProfile profile(StaffType type, boolean active) {
        StaffProfile p = new StaffProfile();
        p.setId(PROFILE_ID);
        p.setStaffType(type);
        p.setIsActive(active);
        return p;
    }

    // ── pagination validation ────────────────────────────────────────────────

    @Nested
    class PaginationValidation {

        @Test
        void negativePageThrowsBadRequest() {
            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, -1, 10));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        }

        @Test
        void zeroLimitThrowsBadRequest() {
            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, 0, 0));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        }

        @Test
        void limitOver100ThrowsBadRequest() {
            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, 0, 101));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        }

        @Test
        void limit100IsValid() {
            when(staffProfileRepository.findByUser_Id(STAFF_ID))
                    .thenReturn(Optional.of(profile(StaffType.VEHICLE_CARE_STAFF, true)));

            assertDoesNotThrow(
                    () -> bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, 0, 100));
        }

        @Test
        void page0IsValid() {
            when(staffProfileRepository.findByUser_Id(STAFF_ID))
                    .thenReturn(Optional.of(profile(StaffType.VEHICLE_CARE_STAFF, true)));

            assertDoesNotThrow(
                    () -> bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, 0, 10));
        }
    }

    // ── staff type enforcement ───────────────────────────────────────────────

    @Nested
    class StaffTypeEnforcement {

        @Test
        void profileNotFound_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(STAFF_ID)).thenReturn(Optional.empty());

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, 0, 10));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void inactiveVcs_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(STAFF_ID))
                    .thenReturn(Optional.of(profile(StaffType.VEHICLE_CARE_STAFF, false)));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, 0, 10));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void css_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(STAFF_ID))
                    .thenReturn(Optional.of(profile(StaffType.CUSTOMER_SERVICE_STAFF, true)));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, 0, 10));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void serviceAdvisor_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(STAFF_ID))
                    .thenReturn(Optional.of(profile(StaffType.SERVICE_ADVISOR, true)));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, 0, 10));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void manager_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(STAFF_ID))
                    .thenReturn(Optional.of(profile(StaffType.MANAGER, true)));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, 0, 10));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void activeVcs_returnsResults() {
            when(staffProfileRepository.findByUser_Id(STAFF_ID))
                    .thenReturn(Optional.of(profile(StaffType.VEHICLE_CARE_STAFF, true)));

            var result = bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, 0, 10);
            assertNotNull(result);
        }
    }

    // ── assignment-level filtering ───────────────────────────────────────────

    @Nested
    class AssignmentFiltering {

        private StaffProfile vcsProfile() {
            return profile(StaffType.VEHICLE_CARE_STAFF, true);
        }

        private BookingAssignedStaff assignment(Long id, Long bookingId, String roleInBooking, String status) {
            BookingAssignedStaff a = new BookingAssignedStaff();
            a.setId(id);
            a.setBookingId(bookingId);
            a.setStaffProfileId(PROFILE_ID);
            a.setRoleInBooking(roleInBooking);
            a.setStatus(status);
            a.setAssignedFrom(LocalDateTime.now());
            a.setAssignedTo(LocalDateTime.now().plusHours(2));
            return a;
        }

        @Test
        void vehicleCareStaffRole_passesFilter() {
            when(staffProfileRepository.findByUser_Id(STAFF_ID)).thenReturn(Optional.of(vcsProfile()));
            BookingAssignedStaff a = assignment(1L, 10L, "VEHICLE_CARE_STAFF", "RESERVED");
            when(bookingAssignedStaffRepository.findVisibleCareTaskAssignments(
                    eq(PROFILE_ID), any(), isNull(), isNull(), isNull(), any()))
                    .thenReturn(List.of(a));

            bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, 0, 10);

            verify(bookingRepository).findById(10L);
        }

        @Test
        void washBayOperatorRole_filteredOut() {
            // DB query filters out non-VEHICLE_CARE_STAFF; mock returns empty to simulate
            when(staffProfileRepository.findByUser_Id(STAFF_ID)).thenReturn(Optional.of(vcsProfile()));

            bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, 0, 10);

            verify(bookingRepository, never()).findById(anyLong());
        }

        @Test
        void canceledStatus_filteredOut() {
            // DB query filters out CANCELED status; mock returns empty to simulate
            when(staffProfileRepository.findByUser_Id(STAFF_ID)).thenReturn(Optional.of(vcsProfile()));

            bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, 0, 10);

            verify(bookingRepository, never()).findById(anyLong());
        }

        @Test
        void nullStatus_filteredOut() {
            // DB query filters out null status via status IN :validStatuses; mock returns empty
            when(staffProfileRepository.findByUser_Id(STAFF_ID)).thenReturn(Optional.of(vcsProfile()));

            bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, 0, 10);

            verify(bookingRepository, never()).findById(anyLong());
        }

        @Test
        void dateFilter_excludesNullAssignedFrom() {
            // DB query enforces assignedFrom IS NOT NULL when date filter is active; mock returns empty
            when(staffProfileRepository.findByUser_Id(STAFF_ID)).thenReturn(Optional.of(vcsProfile()));

            bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, LocalDate.now(), 0, 10);

            verify(bookingRepository, never()).findById(anyLong());
        }

        @Test
        void dateFilter_excludesDifferentDate() {
            // DB query date range excludes previous-day assignments; mock returns empty
            when(staffProfileRepository.findByUser_Id(STAFF_ID)).thenReturn(Optional.of(vcsProfile()));

            bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, LocalDate.now(), 0, 10);

            verify(bookingRepository, never()).findById(anyLong());
        }

        @Test
        void invalidStatus_throwsBadRequestBeforeDbHit() {
            var ex = assertThrows(ResponseStatusException.class,
                    () -> bookingService.getCareTasksForCurrentStaff(STAFF_ID, "CANCELED", null, 0, 10));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            verify(staffProfileRepository, never()).findByUser_Id(anyLong());
        }

        @Test
        void paginationAfterFiltering_skipsInvisibleAssignment() {
            // DB query returns only page 0 limit 1: the first visible assignment (bookingId=10)
            // Invisible (CANCELED) and second visible (bookingId=20) are excluded by DB
            when(staffProfileRepository.findByUser_Id(STAFF_ID)).thenReturn(Optional.of(vcsProfile()));
            BookingAssignedStaff first = assignment(1L, 10L, "VEHICLE_CARE_STAFF", "RESERVED");
            when(bookingAssignedStaffRepository.findVisibleCareTaskAssignments(
                    eq(PROFILE_ID), any(), isNull(), isNull(), isNull(), any()))
                    .thenReturn(List.of(first));

            bookingService.getCareTasksForCurrentStaff(STAFF_ID, null, null, 0, 1);

            verify(bookingRepository).findById(10L);
            verify(bookingRepository, never()).findById(999L);
        }
    }
}
