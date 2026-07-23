package com.autowashpro.service.impl;

import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.Waitlist;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.CustomerLoyaltyRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.StaffProfileRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.repository.VehicleRepository;
import com.autowashpro.repository.WaitlistRepository;
import com.autowashpro.repository.WashBayRepository;
import com.autowashpro.service.BookingService;
import com.autowashpro.service.EmailService;
import com.autowashpro.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WaitlistAuthorizationTest {

    @Mock WaitlistRepository waitlistRepository;
    @Mock StaffProfileRepository staffProfileRepository;
    @Mock GarageRepository garageRepository;
    @Mock VehicleRepository vehicleRepository;
    @Mock ServicePackageRepository servicePackageRepository;
    @Mock WashBayRepository washBayRepository;
    @Mock BookingRepository bookingRepository;
    @Mock CustomerLoyaltyRepository customerLoyaltyRepository;
    @Mock UserRepository userRepository;
    @Mock BookingService bookingService;
    @Mock NotificationService notificationService;
    @Mock EmailService emailService;

    @InjectMocks
    WaitlistServiceImpl waitlistService;

    private static final Long GARAGE_ID = 10L;
    private static final Long STAFF_USER_ID = 1L;
    private static final Long WAITLIST_ID = 42L;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(waitlistService, "cutoffHours", 12);
    }

    // ── fixture builders ─────────────────────────────────────────────────────

    private StaffProfile cssProfile(boolean active, Long garageId) {
        StaffProfile p = new StaffProfile();
        p.setStaffType(StaffType.CUSTOMER_SERVICE_STAFF);
        p.setIsActive(active);
        p.setGarageId(garageId);
        return p;
    }

    private StaffProfile profile(StaffType type) {
        StaffProfile p = new StaffProfile();
        p.setStaffType(type);
        p.setIsActive(true);
        p.setGarageId(GARAGE_ID);
        return p;
    }

    private Waitlist waitlist(String status) {
        Waitlist w = new Waitlist();
        w.setId(WAITLIST_ID);
        w.setGarageId(GARAGE_ID);
        w.setStatus(status);
        w.setVehicleType("CAR");
        w.setDesiredStartTime(LocalDateTime.now().plusDays(2));
        w.setDesiredEndTime(LocalDateTime.now().plusDays(2).plusHours(2));
        return w;
    }

    // ── getAdminWaitlists ────────────────────────────────────────────────────

    @Nested
    class GetAdminWaitlists {

        @Test
        void cssActiveSameGarage_returnsData() {
            when(staffProfileRepository.findByUser_Id(STAFF_USER_ID))
                    .thenReturn(Optional.of(cssProfile(true, GARAGE_ID)));
            when(waitlistRepository.findByGarageIdOrderByCreatedAtDesc(eq(GARAGE_ID), any()))
                    .thenReturn(Page.empty());

            assertDoesNotThrow(() ->
                    waitlistService.getAdminWaitlists(null, null, STAFF_USER_ID, "ROLE_STAFF", 1, 10));
        }

        @Test
        void admin_returnsDataCrossGarage() {
            when(waitlistRepository.findAllByOrderByCreatedAtDesc(any())).thenReturn(Page.empty());

            assertDoesNotThrow(() ->
                    waitlistService.getAdminWaitlists(null, null, STAFF_USER_ID, "ROLE_ADMIN", 1, 10));
        }

        @Test
        void vehicleCareStaff_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(STAFF_USER_ID))
                    .thenReturn(Optional.of(profile(StaffType.VEHICLE_CARE_STAFF)));

            var ex = assertThrows(ResponseStatusException.class, () ->
                    waitlistService.getAdminWaitlists(null, null, STAFF_USER_ID, "ROLE_STAFF", 1, 10));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void serviceAdvisor_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(STAFF_USER_ID))
                    .thenReturn(Optional.of(profile(StaffType.SERVICE_ADVISOR)));

            var ex = assertThrows(ResponseStatusException.class, () ->
                    waitlistService.getAdminWaitlists(null, null, STAFF_USER_ID, "ROLE_STAFF", 1, 10));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void manager_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(STAFF_USER_ID))
                    .thenReturn(Optional.of(profile(StaffType.MANAGER)));

            var ex = assertThrows(ResponseStatusException.class, () ->
                    waitlistService.getAdminWaitlists(null, null, STAFF_USER_ID, "ROLE_STAFF", 1, 10));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void inactiveCssStaff_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(STAFF_USER_ID))
                    .thenReturn(Optional.of(cssProfile(false, GARAGE_ID)));

            var ex = assertThrows(ResponseStatusException.class, () ->
                    waitlistService.getAdminWaitlists(null, null, STAFF_USER_ID, "ROLE_STAFF", 1, 10));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }
    }

    // ── offerWaitlist ────────────────────────────────────────────────────────

    @Nested
    class OfferWaitlist {

        @Test
        void cssActiveSameGarage_proceeds() {
            when(waitlistRepository.findById(WAITLIST_ID)).thenReturn(Optional.of(waitlist("WAITING")));
            when(staffProfileRepository.findByUser_Id(STAFF_USER_ID))
                    .thenReturn(Optional.of(cssProfile(true, GARAGE_ID)));
            when(washBayRepository.countAvailableByGarageAndVehicleType(eq(GARAGE_ID), any()))
                    .thenReturn(2L);
            when(bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                    eq(GARAGE_ID), any(), any(), any(), any())).thenReturn(1L);
            when(waitlistRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertDoesNotThrow(() ->
                    waitlistService.offerWaitlist(WAITLIST_ID, STAFF_USER_ID, "ROLE_STAFF"));
        }

        @Test
        void admin_proceeds() {
            when(waitlistRepository.findById(WAITLIST_ID)).thenReturn(Optional.of(waitlist("WAITING")));
            when(washBayRepository.countAvailableByGarageAndVehicleType(eq(GARAGE_ID), any()))
                    .thenReturn(2L);
            when(bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                    eq(GARAGE_ID), any(), any(), any(), any())).thenReturn(1L);
            when(waitlistRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertDoesNotThrow(() ->
                    waitlistService.offerWaitlist(WAITLIST_ID, STAFF_USER_ID, "ROLE_ADMIN"));
        }

        @Test
        void vehicleCareStaff_throwsForbidden() {
            when(waitlistRepository.findById(WAITLIST_ID)).thenReturn(Optional.of(waitlist("WAITING")));
            when(staffProfileRepository.findByUser_Id(STAFF_USER_ID))
                    .thenReturn(Optional.of(profile(StaffType.VEHICLE_CARE_STAFF)));

            var ex = assertThrows(ResponseStatusException.class, () ->
                    waitlistService.offerWaitlist(WAITLIST_ID, STAFF_USER_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void serviceAdvisorAndManager_throwsForbidden() {
            when(waitlistRepository.findById(WAITLIST_ID)).thenReturn(Optional.of(waitlist("WAITING")));
            when(staffProfileRepository.findByUser_Id(STAFF_USER_ID))
                    .thenReturn(Optional.of(profile(StaffType.SERVICE_ADVISOR)));

            var ex = assertThrows(ResponseStatusException.class, () ->
                    waitlistService.offerWaitlist(WAITLIST_ID, STAFF_USER_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void inactiveCssStaff_throwsForbidden() {
            when(waitlistRepository.findById(WAITLIST_ID)).thenReturn(Optional.of(waitlist("WAITING")));
            when(staffProfileRepository.findByUser_Id(STAFF_USER_ID))
                    .thenReturn(Optional.of(cssProfile(false, GARAGE_ID)));

            var ex = assertThrows(ResponseStatusException.class, () ->
                    waitlistService.offerWaitlist(WAITLIST_ID, STAFF_USER_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void cssOtherGarage_throwsForbidden() {
            when(waitlistRepository.findById(WAITLIST_ID)).thenReturn(Optional.of(waitlist("WAITING")));
            when(staffProfileRepository.findByUser_Id(STAFF_USER_ID))
                    .thenReturn(Optional.of(cssProfile(true, 99L)));

            var ex = assertThrows(ResponseStatusException.class, () ->
                    waitlistService.offerWaitlist(WAITLIST_ID, STAFF_USER_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }
    }

    // ── expireWaitlist ───────────────────────────────────────────────────────

    @Nested
    class ExpireWaitlist {

        @Test
        void cssActiveSameGarage_proceeds() {
            when(waitlistRepository.findById(WAITLIST_ID)).thenReturn(Optional.of(waitlist("WAITING")));
            when(staffProfileRepository.findByUser_Id(STAFF_USER_ID))
                    .thenReturn(Optional.of(cssProfile(true, GARAGE_ID)));
            when(waitlistRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertDoesNotThrow(() ->
                    waitlistService.expireWaitlist(WAITLIST_ID, STAFF_USER_ID, "ROLE_STAFF"));
        }

        @Test
        void vehicleCareStaff_throwsForbidden() {
            when(waitlistRepository.findById(WAITLIST_ID)).thenReturn(Optional.of(waitlist("WAITING")));
            when(staffProfileRepository.findByUser_Id(STAFF_USER_ID))
                    .thenReturn(Optional.of(profile(StaffType.VEHICLE_CARE_STAFF)));

            var ex = assertThrows(ResponseStatusException.class, () ->
                    waitlistService.expireWaitlist(WAITLIST_ID, STAFF_USER_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void cssOtherGarage_throwsForbidden() {
            when(waitlistRepository.findById(WAITLIST_ID)).thenReturn(Optional.of(waitlist("WAITING")));
            when(staffProfileRepository.findByUser_Id(STAFF_USER_ID))
                    .thenReturn(Optional.of(cssProfile(true, 99L)));

            var ex = assertThrows(ResponseStatusException.class, () ->
                    waitlistService.expireWaitlist(WAITLIST_ID, STAFF_USER_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }
    }
}
