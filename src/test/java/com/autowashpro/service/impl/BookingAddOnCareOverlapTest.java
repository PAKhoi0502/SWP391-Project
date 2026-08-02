package com.autowashpro.service.impl;

import com.autowashpro.dto.request.AddBookingAddOnsRequest;
import com.autowashpro.dto.response.AddOnAvailabilityResponse;
import com.autowashpro.dto.response.BookingResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.BookingAddOnServicePackage;
import com.autowashpro.entity.BookingAssignedStaff;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.repository.BookingAddOnServicePackageRepository;
import com.autowashpro.repository.BookingAssignedStaffRepository;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.BookingServiceStepRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.GarageServicePackageRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.ServicePackageStepRepository;
import com.autowashpro.repository.StaffProfileRepository;
import com.autowashpro.service.support.PackageResourceResolver;
import com.autowashpro.service.support.StaffOperationAccessPolicy;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Reproduces the reported scenario: garage has a single VEHICLE_CARE_STAFF.
 * Booking A is mid-service with one add-on already committed. Booking B —
 * created separately — already holds that same staff member for a later,
 * non-overlapping window. Staff then try to tack one more add-on onto A via
 * addBookingAddOns(); if the new add-on's care duration pushes A's care
 * window into B's reserved window, the request must be rejected, and
 * getAddOnAvailability() must report that add-on as unavailable up front.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BookingAddOnCareOverlapTest {

    @Mock private BookingRepository bookingRepository;
    @Mock private StaffOperationAccessPolicy staffOperationAccessPolicy;
    @Mock private ServicePackageRepository servicePackageRepository;
    @Mock private ServicePackageStepRepository servicePackageStepRepository;
    @Mock private BookingAddOnServicePackageRepository bookingAddOnServicePackageRepository;
    @Mock private BookingServiceStepRepository bookingServiceStepRepository;
    @Mock private BookingAssignedStaffRepository bookingAssignedStaffRepository;
    @Mock private StaffProfileRepository staffProfileRepository;
    @Mock private GarageRepository garageRepository;
    @Mock private GarageServicePackageRepository garageServicePackageRepository;
    @Mock private PackageResourceResolver packageResourceResolver;

    @InjectMocks
    private BookingServiceImpl bookingService;

    private static final Long GARAGE_ID = 1L;
    private static final Long BOOKING_A_ID = 30L;
    private static final Long BOOKING_B_ID = 31L;
    private static final Long STAFF_ID = 100L;

    private ServicePackage mainPackage() {
        return ServicePackage.builder()
                .id(1L).name("Main Wash").vehicleType("CAR").serviceType("MAIN")
                .basePrice(new BigDecimal("100000"))
                .requiresWashBay(true).washBayDurationMinutes(30)
                .requiresCareStaff(true).careStaffType("VEHICLE_CARE_STAFF")
                .careStaffRequiredCount(1).careStaffDurationMinutes(15)
                .isActive(true)
                .build();
    }

    private ServicePackage existingAddOn() {
        return ServicePackage.builder()
                .id(2L).name("Existing AddOn").vehicleType("CAR").serviceType("ADD_ON")
                .basePrice(new BigDecimal("30000"))
                .requiresWashBay(false)
                .requiresCareStaff(true).careStaffType("VEHICLE_CARE_STAFF")
                .careStaffRequiredCount(1).careStaffDurationMinutes(30)
                .isActive(true)
                .build();
    }

    private ServicePackage newAddOn() {
        return ServicePackage.builder()
                .id(3L).name("New AddOn").vehicleType("CAR").serviceType("ADD_ON")
                .basePrice(new BigDecimal("40000"))
                .requiresWashBay(false)
                .requiresCareStaff(true).careStaffType("VEHICLE_CARE_STAFF")
                .careStaffRequiredCount(1).careStaffDurationMinutes(60)
                .isActive(true)
                .build();
    }

    private Booking bookingA() {
        Booking b = new Booking();
        b.setId(BOOKING_A_ID);
        b.setGarageId(GARAGE_ID);
        b.setServicePackageId(1L);
        b.setVehicleId(null);
        b.setVehicleType("CAR");
        b.setStatus("IN_PROGRESS");
        b.setOperationPhase("VEHICLE_CARE"); // pastWash = true
        b.setPaymentStatus("UNPAID");
        b.setStartTime(LocalDateTime.of(2026, 8, 3, 7, 0));
        b.setEndTime(LocalDateTime.of(2026, 8, 3, 8, 15));
        b.setOriginalPrice(new BigDecimal("130000"));
        b.setFinalPrice(new BigDecimal("130000"));
        b.setRewardProcessed(false);
        return b;
    }

    private void stubCommon(Booking bookingA, ServicePackage main, ServicePackage existingAddOn, ServicePackage newAddOn) {
        lenient().when(bookingRepository.findByIdWithLock(BOOKING_A_ID)).thenReturn(Optional.of(bookingA));
        lenient().when(bookingRepository.findById(BOOKING_A_ID)).thenReturn(Optional.of(bookingA));
        lenient().when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(bookingRepository.countByCustomerIdAndIdLessThanEqual(anyLong(), anyLong())).thenReturn(0L);

        lenient().when(servicePackageRepository.findById(1L)).thenReturn(Optional.of(main));
        lenient().when(servicePackageRepository.findById(2L)).thenReturn(Optional.of(existingAddOn));
        lenient().when(servicePackageRepository.findById(3L)).thenReturn(Optional.of(newAddOn));

        // A already has "existingAddOn" (id=2) committed.
        BookingAddOnServicePackage existingLink = new BookingAddOnServicePackage();
        existingLink.setBookingId(BOOKING_A_ID);
        existingLink.setServicePackageId(2L);
        existingLink.setSortOrder(1);
        lenient().when(bookingAddOnServicePackageRepository.findByBookingIdOrderBySortOrderAsc(BOOKING_A_ID))
                .thenReturn(List.of(existingLink));
        lenient().when(bookingAddOnServicePackageRepository.existsByBookingIdAndServicePackageId(anyLong(), anyLong()))
                .thenReturn(false);
        lenient().when(bookingAddOnServicePackageRepository.save(any(BookingAddOnServicePackage.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        lenient().when(garageServicePackageRepository.existsByGarageIdAndServicePackageIdAndIsActiveTrue(anyLong(), anyLong()))
                .thenReturn(true);

        lenient().when(servicePackageStepRepository.findByServicePackage_IdOrderByStepOrder(anyLong()))
                .thenReturn(List.of());
        lenient().when(bookingServiceStepRepository.findByBookingIdOrderByStepOrder(anyLong()))
                .thenReturn(List.of());
        lenient().when(bookingServiceStepRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        lenient().when(packageResourceResolver.resolveEffectivePackages(any()))
                .thenAnswer(inv -> List.of(inv.getArgument(0, ServicePackage.class)));

        Garage garage = new Garage();
        garage.setId(GARAGE_ID);
        garage.setSlotIntervalMinutes(30);
        lenient().when(garageRepository.findById(GARAGE_ID)).thenReturn(Optional.of(garage));

        StaffProfile staff = new StaffProfile();
        staff.setId(STAFF_ID);
        staff.setGarageId(GARAGE_ID);
        staff.setStaffType(StaffType.VEHICLE_CARE_STAFF);
        staff.setIsActive(true);
        lenient().when(staffProfileRepository.findByGarageIdAndStaffTypeAndIsActiveTrue(GARAGE_ID, StaffType.VEHICLE_CARE_STAFF))
                .thenReturn(List.of(staff));

        // A's existing care assignment: reflects main(15) + existingAddOn(30) = 45 min of care,
        // starting right after the 30-min wash at 7:00 → wash ends 7:30, care 7:30–8:15.
        LocalDateTime careStartA = LocalDateTime.of(2026, 8, 3, 7, 30);
        LocalDateTime careEndA = LocalDateTime.of(2026, 8, 3, 8, 15);
        BookingAssignedStaff assignmentA = new BookingAssignedStaff();
        assignmentA.setId(1000L);
        assignmentA.setBookingId(BOOKING_A_ID);
        assignmentA.setStaffProfileId(STAFF_ID);
        assignmentA.setAssignedFrom(careStartA);
        assignmentA.setAssignedTo(careEndA);
        assignmentA.setRoleInBooking("VEHICLE_CARE_STAFF");
        assignmentA.setStatus("ACTIVE");
        lenient().when(bookingAssignedStaffRepository.findByBookingId(BOOKING_A_ID))
                .thenReturn(List.of(assignmentA));
        lenient().when(bookingAssignedStaffRepository.save(any(BookingAssignedStaff.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // Booking B already reserved the SAME (only) staff member for 8:15–9:15 — right after
        // A's current window ends, so it does NOT conflict with A's window as-is.
        LocalDateTime careStartB = LocalDateTime.of(2026, 8, 3, 8, 15);
        LocalDateTime careEndB = LocalDateTime.of(2026, 8, 3, 9, 15);
        lenient().when(bookingAssignedStaffRepository.countOverlapExcludingBooking(
                        org.mockito.ArgumentMatchers.eq(STAFF_ID), org.mockito.ArgumentMatchers.eq(BOOKING_A_ID),
                        any(), any()))
                .thenAnswer(inv -> {
                    LocalDateTime start = inv.getArgument(2);
                    LocalDateTime end = inv.getArgument(3);
                    boolean overlapsB = careStartB.isBefore(end) && careEndB.isAfter(start);
                    return overlapsB ? 1L : 0L;
                });
    }

    @Test
    void addBookingAddOnsIsRejectedWhenExtensionWouldOverlapAnotherBookingsCareStaff() {
        Booking bookingA = bookingA();
        stubCommon(bookingA, mainPackage(), existingAddOn(), newAddOn());

        // Adding newAddOn (60 min care) would push A's care window from 7:30–8:15 to
        // 7:30–9:15 (main 15 + existingAddOn 30 + newAddOn 60 = 105 min), which overlaps
        // B's reserved 8:15–9:15 window on the garage's only care staff member.
        AddBookingAddOnsRequest request = new AddBookingAddOnsRequest();
        request.setServicePackageIds(List.of(3L));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.addBookingAddOns(BOOKING_A_ID, 2L, "ROLE_STAFF", request));

        assertTrue(ex.getReason() != null && ex.getReason().contains("CARE_STAFF_CAPACITY_FULL"),
                "Expected a CARE_STAFF_CAPACITY_FULL rejection but got: " + ex.getReason());
    }

    @Test
    void getAddOnAvailabilityFlagsTheConflictingAddOnBeforeSubmission() {
        Booking bookingA = bookingA();
        stubCommon(bookingA, mainPackage(), existingAddOn(), newAddOn());

        List<AddOnAvailabilityResponse> results = bookingService.getAddOnAvailability(
                BOOKING_A_ID, 2L, "ROLE_STAFF", List.of(3L));

        assertEquals(1, results.size());
        assertFalse(results.get(0).getAvailable(), "New add-on should be flagged unavailable");
        assertTrue(results.get(0).getReason() != null
                        && results.get(0).getReason().contains("CARE_STAFF_CAPACITY_FULL"),
                "Expected CARE_STAFF_CAPACITY_FULL reason but got: " + results.get(0).getReason());
    }

    @Test
    void addBookingAddOnsSucceedsWhenExtensionStaysBeforeTheNextBooking() {
        Booking bookingA = bookingA();
        // Use a shorter add-on (20 min) so the extended window (7:30–8:35) still fits inside
        // the 7:30–8:15... actually pick one that ends before 8:15 to stay conflict-free.
        ServicePackage shortAddOn = ServicePackage.builder()
                .id(3L).name("Short AddOn").vehicleType("CAR").serviceType("ADD_ON")
                .basePrice(new BigDecimal("10000"))
                .requiresWashBay(false)
                .requiresCareStaff(true).careStaffType("VEHICLE_CARE_STAFF")
                .careStaffRequiredCount(1).careStaffDurationMinutes(0)
                .isActive(true)
                .build();
        stubCommon(bookingA, mainPackage(), existingAddOn(), shortAddOn);

        AddBookingAddOnsRequest request = new AddBookingAddOnsRequest();
        request.setServicePackageIds(List.of(3L));

        BookingResponse response = bookingService.addBookingAddOns(BOOKING_A_ID, 2L, "ROLE_STAFF", request);

        assertEquals(BOOKING_A_ID, response.getId());
    }

    @Test
    void addBookingAddOnsReassignsToAFreeStaffMemberWhenGarageHasMoreThanOne() {
        Booking bookingA = bookingA();
        stubCommon(bookingA, mainPackage(), existingAddOn(), newAddOn());

        // Garage actually has a SECOND care staff member who is completely free — the
        // original assigned staff (100) still conflicts with B, but staff 101 does not.
        StaffProfile secondStaff = new StaffProfile();
        secondStaff.setId(101L);
        secondStaff.setGarageId(GARAGE_ID);
        secondStaff.setStaffType(StaffType.VEHICLE_CARE_STAFF);
        secondStaff.setIsActive(true);
        when(staffProfileRepository.findByGarageIdAndStaffTypeAndIsActiveTrue(GARAGE_ID, StaffType.VEHICLE_CARE_STAFF))
                .thenReturn(List.of(
                        staffProfileWithId(STAFF_ID),
                        secondStaff));
        lenient().when(bookingAssignedStaffRepository.countOverlapExcludingBooking(
                        org.mockito.ArgumentMatchers.eq(101L), any(), any(), any()))
                .thenReturn(0L);

        AddBookingAddOnsRequest request = new AddBookingAddOnsRequest();
        request.setServicePackageIds(List.of(3L));

        BookingResponse response = bookingService.addBookingAddOns(BOOKING_A_ID, 2L, "ROLE_STAFF", request);

        assertEquals(BOOKING_A_ID, response.getId());
    }

    private StaffProfile staffProfileWithId(Long id) {
        StaffProfile staff = new StaffProfile();
        staff.setId(id);
        staff.setGarageId(GARAGE_ID);
        staff.setStaffType(StaffType.VEHICLE_CARE_STAFF);
        staff.setIsActive(true);
        return staff;
    }
}
