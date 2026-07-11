package com.autowashpro.service.support;

import com.autowashpro.entity.Booking;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.repository.StaffProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
    void allowsActiveStaffFromBookingGarage() {
        Booking booking = booking(10L);
        StaffProfile staff = new StaffProfile();
        staff.setGarageId(10L);
        staff.setIsActive(true);
        when(staffProfileRepository.findByUser_Id(2L)).thenReturn(Optional.of(staff));

        assertDoesNotThrow(() -> policy.requireCanManage(booking, 2L, "ROLE_STAFF"));
    }

    @Test
    void rejectsCustomerInactiveStaffAndOtherGarage() {
        Booking booking = booking(10L);
        StaffProfile inactive = new StaffProfile();
        inactive.setGarageId(10L);
        inactive.setIsActive(false);
        StaffProfile otherGarage = new StaffProfile();
        otherGarage.setGarageId(11L);
        otherGarage.setIsActive(true);

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
}
