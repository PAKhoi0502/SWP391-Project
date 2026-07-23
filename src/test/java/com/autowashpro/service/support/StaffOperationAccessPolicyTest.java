package com.autowashpro.service.support;

import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.repository.StaffProfileRepository;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StaffOperationAccessPolicyTest {

    @Mock
    StaffProfileRepository staffProfileRepository;

    @InjectMocks
    StaffOperationAccessPolicy policy;

    private StaffProfile profile(StaffType type, boolean active, Long garageId) {
        StaffProfile p = new StaffProfile();
        p.setStaffType(type);
        p.setIsActive(active);
        p.setGarageId(garageId);
        return p;
    }

    // ── requireCustomerServiceStaff ──────────────────────────────────────────

    @Nested
    class RequireCustomerServiceStaff {

        @Test
        void activeCss_returnsProfile() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.CUSTOMER_SERVICE_STAFF, true, 10L)));

            StaffProfile result = policy.requireCustomerServiceStaff(1L);
            assertNotNull(result);
        }

        @Test
        void notFound_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(1L)).thenReturn(Optional.empty());

            var ex = assertThrows(ResponseStatusException.class, () -> policy.requireCustomerServiceStaff(1L));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void inactive_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.CUSTOMER_SERVICE_STAFF, false, 10L)));

            var ex = assertThrows(ResponseStatusException.class, () -> policy.requireCustomerServiceStaff(1L));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void vehicleCareStaff_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.VEHICLE_CARE_STAFF, true, 10L)));

            var ex = assertThrows(ResponseStatusException.class, () -> policy.requireCustomerServiceStaff(1L));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void serviceAdvisor_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.SERVICE_ADVISOR, true, 10L)));

            var ex = assertThrows(ResponseStatusException.class, () -> policy.requireCustomerServiceStaff(1L));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void manager_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.MANAGER, true, 10L)));

            var ex = assertThrows(ResponseStatusException.class, () -> policy.requireCustomerServiceStaff(1L));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }
    }

    // ── requireCustomerServiceStaffForGarage ─────────────────────────────────

    @Nested
    class RequireCustomerServiceStaffForGarage {

        @Test
        void cssSameGarage_returnsProfile() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.CUSTOMER_SERVICE_STAFF, true, 10L)));

            StaffProfile result = policy.requireCustomerServiceStaffForGarage(1L, 10L);
            assertNotNull(result);
        }

        @Test
        void cssDifferentGarage_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.CUSTOMER_SERVICE_STAFF, true, 10L)));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> policy.requireCustomerServiceStaffForGarage(1L, 99L));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void inactiveCss_throwsForbiddenBeforeGarageCheck() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.CUSTOMER_SERVICE_STAFF, false, 10L)));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> policy.requireCustomerServiceStaffForGarage(1L, 10L));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void profileGarageIdNull_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.CUSTOMER_SERVICE_STAFF, true, null)));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> policy.requireCustomerServiceStaffForGarage(1L, 10L));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void targetGarageIdNull_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.CUSTOMER_SERVICE_STAFF, true, 10L)));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> policy.requireCustomerServiceStaffForGarage(1L, null));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void bothGarageIdsNull_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.CUSTOMER_SERVICE_STAFF, true, null)));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> policy.requireCustomerServiceStaffForGarage(1L, null));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }
    }

    // ── requireCustomerServiceOrAdmin ────────────────────────────────────────

    @Nested
    class RequireCustomerServiceOrAdmin {

        @Test
        void admin_returnsNullWithoutDbCall() {
            StaffProfile result = policy.requireCustomerServiceOrAdmin(1L, "ROLE_ADMIN");
            assertNull(result);
            verify(staffProfileRepository, never()).findByUser_Id(any());
        }

        @Test
        void activeCssStaff_returnsProfile() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.CUSTOMER_SERVICE_STAFF, true, 10L)));

            StaffProfile result = policy.requireCustomerServiceOrAdmin(1L, "ROLE_STAFF");
            assertNotNull(result);
        }

        @Test
        void vcsStaff_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.VEHICLE_CARE_STAFF, true, 10L)));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> policy.requireCustomerServiceOrAdmin(1L, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void roleCustomer_throwsForbiddenWithoutDbCall() {
            var ex = assertThrows(ResponseStatusException.class,
                    () -> policy.requireCustomerServiceOrAdmin(1L, "ROLE_CUSTOMER"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            verify(staffProfileRepository, never()).findByUser_Id(any());
        }

        @Test
        void unknownRole_throwsForbiddenWithoutDbCall() {
            var ex = assertThrows(ResponseStatusException.class,
                    () -> policy.requireCustomerServiceOrAdmin(1L, "ROLE_UNKNOWN"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            verify(staffProfileRepository, never()).findByUser_Id(any());
        }
    }

    // ── requireCustomerServiceOrAdminForGarage ───────────────────────────────

    @Nested
    class RequireCustomerServiceOrAdminForGarage {

        @Test
        void admin_returnsNullNoGarageCheck() {
            StaffProfile result = policy.requireCustomerServiceOrAdminForGarage(1L, "ROLE_ADMIN", 10L);
            assertNull(result);
            verify(staffProfileRepository, never()).findByUser_Id(any());
        }

        @Test
        void cssSameGarage_returnsProfile() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.CUSTOMER_SERVICE_STAFF, true, 10L)));

            StaffProfile result = policy.requireCustomerServiceOrAdminForGarage(1L, "ROLE_STAFF", 10L);
            assertNotNull(result);
        }

        @Test
        void cssDifferentGarage_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.CUSTOMER_SERVICE_STAFF, true, 10L)));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> policy.requireCustomerServiceOrAdminForGarage(1L, "ROLE_STAFF", 99L));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void vcs_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.VEHICLE_CARE_STAFF, true, 10L)));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> policy.requireCustomerServiceOrAdminForGarage(1L, "ROLE_STAFF", 10L));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void cssNullProfileGarageId_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.CUSTOMER_SERVICE_STAFF, true, null)));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> policy.requireCustomerServiceOrAdminForGarage(1L, "ROLE_STAFF", 10L));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void nullTargetGarageId_throwsForbidden() {
            when(staffProfileRepository.findByUser_Id(1L))
                    .thenReturn(Optional.of(profile(StaffType.CUSTOMER_SERVICE_STAFF, true, 10L)));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> policy.requireCustomerServiceOrAdminForGarage(1L, "ROLE_STAFF", null));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }
    }
}
