package com.autowashpro.service.support;

import com.autowashpro.entity.Booking;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.repository.StaffProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InspectionAccessPolicyTest {

    @Mock
    private StaffProfileRepository staffProfileRepository;

    @InjectMocks
    private InspectionAccessPolicy policy;

    @Test
    void allowsAdminWithoutStaffProfile() {
        Booking booking = booking(10L);

        assertDoesNotThrow(() -> policy.requireCanManage(booking, 1L, "ROLE_ADMIN"));

        verify(staffProfileRepository, never()).findByUser_Id(1L);
    }

    @Test
    void allowsActiveCustomerServiceStaffFromBookingGarage() {
        Booking booking = booking(10L);
        StaffProfile staff = new StaffProfile();
        staff.setGarageId(10L);
        staff.setIsActive(true);
        // Only CUSTOMER_SERVICE_STAFF may manage inspections.
        staff.setStaffType(StaffType.CUSTOMER_SERVICE_STAFF);
        when(staffProfileRepository.findByUser_Id(2L)).thenReturn(Optional.of(staff));

        assertDoesNotThrow(() -> policy.requireCanManage(booking, 2L, "ROLE_STAFF"));
    }

    @Test
    void rejectsVehicleCareStaff() {
        Booking booking = booking(10L);
        StaffProfile careStaff = new StaffProfile();
        careStaff.setGarageId(10L);
        careStaff.setIsActive(true);
        careStaff.setStaffType(StaffType.VEHICLE_CARE_STAFF);
        when(staffProfileRepository.findByUser_Id(6L)).thenReturn(Optional.of(careStaff));

        assertThrows(ResponseStatusException.class,
                () -> policy.requireCanManage(booking, 6L, "ROLE_STAFF"));
    }

    @Test
    void rejectsCustomerInactiveStaffAndOtherGarage() {
        Booking booking = booking(10L);
        StaffProfile inactive = new StaffProfile();
        inactive.setGarageId(10L);
        inactive.setIsActive(false);
        inactive.setStaffType(StaffType.CUSTOMER_SERVICE_STAFF);
        StaffProfile otherGarage = new StaffProfile();
        otherGarage.setGarageId(11L);
        otherGarage.setIsActive(true);
        otherGarage.setStaffType(StaffType.CUSTOMER_SERVICE_STAFF);

        assertThrows(ResponseStatusException.class,
                () -> policy.requireCanManage(booking, 3L, "ROLE_CUSTOMER"));

        when(staffProfileRepository.findByUser_Id(4L)).thenReturn(Optional.of(inactive));
        assertThrows(ResponseStatusException.class,
                () -> policy.requireCanManage(booking, 4L, "ROLE_STAFF"));

        when(staffProfileRepository.findByUser_Id(5L)).thenReturn(Optional.of(otherGarage));
        assertThrows(ResponseStatusException.class,
                () -> policy.requireCanManage(booking, 5L, "ROLE_STAFF"));
    }

    private Booking booking(Long garageId) {
        Booking booking = new Booking();
        booking.setGarageId(garageId);
        return booking;
    }

    private Booking bookingWithCustomer(Long garageId, Long customerId) {
        Booking booking = new Booking();
        booking.setGarageId(garageId);
        booking.setCustomerId(customerId);
        return booking;
    }

    // ── requireCanRead ───────────────────────────────────────────────────────

    @Test
    void read_allowsAdmin() {
        assertDoesNotThrow(() -> policy.requireCanRead(booking(10L), 1L, "ROLE_ADMIN"));
        verify(staffProfileRepository, never()).findByUser_Id(any());
    }

    @Test
    void read_allowsCustomerViewingOwnBooking() {
        Booking booking = bookingWithCustomer(10L, 5L);
        assertDoesNotThrow(() -> policy.requireCanRead(booking, 5L, "ROLE_CUSTOMER"));
    }

    @Test
    void read_rejectsCustomerViewingOtherBooking() {
        Booking booking = bookingWithCustomer(10L, 5L);
        var ex = assertThrows(ResponseStatusException.class,
                () -> policy.requireCanRead(booking, 99L, "ROLE_CUSTOMER"));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    void read_allowsActiveCssFromSameGarage() {
        Booking booking = booking(10L);
        StaffProfile staff = new StaffProfile();
        staff.setGarageId(10L);
        staff.setIsActive(true);
        staff.setStaffType(StaffType.CUSTOMER_SERVICE_STAFF);
        when(staffProfileRepository.findByUser_Id(2L)).thenReturn(Optional.of(staff));

        assertDoesNotThrow(() -> policy.requireCanRead(booking, 2L, "ROLE_STAFF"));
    }

    @Test
    void read_rejectsCssFromOtherGarage() {
        Booking booking = booking(10L);
        StaffProfile staff = new StaffProfile();
        staff.setGarageId(99L);
        staff.setIsActive(true);
        staff.setStaffType(StaffType.CUSTOMER_SERVICE_STAFF);
        when(staffProfileRepository.findByUser_Id(2L)).thenReturn(Optional.of(staff));

        assertThrows(ResponseStatusException.class, () -> policy.requireCanRead(booking, 2L, "ROLE_STAFF"));
    }

    @Test
    void read_rejectsInactiveCssStaff() {
        Booking booking = booking(10L);
        StaffProfile staff = new StaffProfile();
        staff.setGarageId(10L);
        staff.setIsActive(false);
        staff.setStaffType(StaffType.CUSTOMER_SERVICE_STAFF);
        when(staffProfileRepository.findByUser_Id(3L)).thenReturn(Optional.of(staff));

        assertThrows(ResponseStatusException.class, () -> policy.requireCanRead(booking, 3L, "ROLE_STAFF"));
    }

    @Test
    void read_rejectsVehicleCareStaff() {
        Booking booking = booking(10L);
        StaffProfile staff = new StaffProfile();
        staff.setGarageId(10L);
        staff.setIsActive(true);
        staff.setStaffType(StaffType.VEHICLE_CARE_STAFF);
        when(staffProfileRepository.findByUser_Id(4L)).thenReturn(Optional.of(staff));

        assertThrows(ResponseStatusException.class, () -> policy.requireCanRead(booking, 4L, "ROLE_STAFF"));
    }

    @Test
    void read_rejectsServiceAdvisorAndManager() {
        Booking booking = booking(10L);

        StaffProfile advisor = new StaffProfile();
        advisor.setGarageId(10L);
        advisor.setIsActive(true);
        advisor.setStaffType(StaffType.SERVICE_ADVISOR);
        when(staffProfileRepository.findByUser_Id(5L)).thenReturn(Optional.of(advisor));
        assertThrows(ResponseStatusException.class, () -> policy.requireCanRead(booking, 5L, "ROLE_STAFF"));

        StaffProfile manager = new StaffProfile();
        manager.setGarageId(10L);
        manager.setIsActive(true);
        manager.setStaffType(StaffType.MANAGER);
        when(staffProfileRepository.findByUser_Id(6L)).thenReturn(Optional.of(manager));
        assertThrows(ResponseStatusException.class, () -> policy.requireCanRead(booking, 6L, "ROLE_STAFF"));
    }

    @Test
    void read_rejectsUnknownRole() {
        Booking booking = booking(10L);
        assertThrows(ResponseStatusException.class,
                () -> policy.requireCanRead(booking, 7L, "ROLE_UNKNOWN"));
    }
}
