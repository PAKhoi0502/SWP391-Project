package com.autowashpro.service.impl;

import com.autowashpro.dto.request.WashBayStatusUpdateRequest;
import com.autowashpro.dto.response.WashBayResponse;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.WashBay;
import com.autowashpro.entity.enums.WashBayStatus;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.WashBayRepository;
import com.autowashpro.service.support.StaffOperationAccessPolicy;
import com.autowashpro.support.TestFixtures;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.autowashpro.dto.response.PageResponse;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WashBayAuthorizationTest {

    @Mock WashBayRepository washBayRepository;
    @Mock GarageRepository garageRepository;
    @Mock StaffOperationAccessPolicy staffOperationAccessPolicy;

    @InjectMocks
    WashBayServiceImpl washBayService;

    private static final Long GARAGE_ID = 10L;
    private static final Long STAFF_ID = 1L;
    private static final Long OTHER_GARAGE_ID = 99L;

    private void stubPolicyAllow(Long staffId, String role, Long garageId) {
        when(staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(staffId, role, garageId))
                .thenReturn(role.contains("ADMIN") ? null : new com.autowashpro.entity.StaffProfile());
    }

    private void stubPolicyDeny(Long staffId, String role, Long garageId) {
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"))
                .when(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(staffId, role, garageId);
    }

    private com.autowashpro.entity.StaffProfile cssProfile(Long garageId) {
        com.autowashpro.entity.StaffProfile p = new com.autowashpro.entity.StaffProfile();
        p.setGarageId(garageId);
        return p;
    }

    private void stubReadPolicyAllow(Long staffId, String role) {
        when(staffOperationAccessPolicy.requireCustomerServiceOrAdmin(staffId, role))
                .thenReturn("ROLE_ADMIN".equals(role) ? null : cssProfile(GARAGE_ID));
    }

    private void stubReadPolicyDeny(Long staffId, String role) {
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"))
                .when(staffOperationAccessPolicy).requireCustomerServiceOrAdmin(staffId, role);
    }

    // ── getById authorization ────────────────────────────────────────────────

    @Nested
    class GetById {

        private WashBay washBay() {
            Garage garage = TestFixtures.garage();
            garage.setId(GARAGE_ID);
            return TestFixtures.washBay(garage);
        }

        @Test
        void admin_succeeds() {
            WashBay bay = washBay();
            when(washBayRepository.findById(bay.getId())).thenReturn(Optional.of(bay));
            stubReadPolicyAllow(STAFF_ID, "ROLE_ADMIN");

            assertDoesNotThrow(() -> washBayService.getById(bay.getId(), STAFF_ID, "ROLE_ADMIN"));
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_ADMIN");
        }

        @Test
        void cssSameGarage_succeeds() {
            WashBay bay = washBay();
            when(washBayRepository.findById(bay.getId())).thenReturn(Optional.of(bay));
            stubReadPolicyAllow(STAFF_ID, "ROLE_STAFF");

            assertDoesNotThrow(() -> washBayService.getById(bay.getId(), STAFF_ID, "ROLE_STAFF"));
        }

        @Test
        void cssOtherGarage_throwsForbidden() {
            Garage otherGarage = TestFixtures.garage();
            otherGarage.setId(OTHER_GARAGE_ID);
            WashBay bay = TestFixtures.washBay(otherGarage);
            when(washBayRepository.findById(bay.getId())).thenReturn(Optional.of(bay));
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_STAFF"))
                    .thenReturn(cssProfile(GARAGE_ID));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> washBayService.getById(bay.getId(), STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }

        @Test
        void vcs_throwsForbidden() {
            WashBay bay = washBay();
            when(washBayRepository.findById(bay.getId())).thenReturn(Optional.of(bay));
            stubReadPolicyDeny(STAFF_ID, "ROLE_STAFF");

            var ex = assertThrows(ResponseStatusException.class,
                    () -> washBayService.getById(bay.getId(), STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        }
    }

    // ── list authorization ───────────────────────────────────────────────────

    @Nested
    class List_ {

        @Test
        void admin_succeeds() {
            stubReadPolicyAllow(STAFF_ID, "ROLE_ADMIN");
            when(washBayRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of()));

            assertDoesNotThrow(() -> washBayService.list(1, 10, null, null, null, STAFF_ID, "ROLE_ADMIN"));
        }

        @Test
        void cssSameGarage_succeeds() {
            stubReadPolicyAllow(STAFF_ID, "ROLE_STAFF");
            when(washBayRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of()));

            assertDoesNotThrow(() -> washBayService.list(1, 10, GARAGE_ID, null, null, STAFF_ID, "ROLE_STAFF"));
        }

        @Test
        void cssOtherGarage_throwsForbidden() {
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_STAFF"))
                    .thenReturn(cssProfile(GARAGE_ID));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> washBayService.list(1, 10, OTHER_GARAGE_ID, null, null, STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            verify(washBayRepository, never()).findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class));
        }

        @Test
        void vcs_throwsForbidden() {
            stubReadPolicyDeny(STAFF_ID, "ROLE_STAFF");

            var ex = assertThrows(ResponseStatusException.class,
                    () -> washBayService.list(1, 10, null, null, null, STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            verify(washBayRepository, never()).findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class));
        }

        @Test
        void cssWithNullGarageId_autoScopedToOwnGarage() {
            stubReadPolicyAllow(STAFF_ID, "ROLE_STAFF");
            when(washBayRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of()));

            PageResponse<WashBayResponse> result = washBayService.list(1, 10, null, null, null, STAFF_ID, "ROLE_STAFF");
            assertNotNull(result);
        }
    }

    // ── getCapacity authorization ────────────────────────────────────────────

    @Nested
    class GetCapacity {

        @Test
        void admin_succeeds() {
            stubReadPolicyAllow(STAFF_ID, "ROLE_ADMIN");
            when(garageRepository.existsById(GARAGE_ID)).thenReturn(true);
            when(washBayRepository.countAvailableGroupedByVehicleType(GARAGE_ID)).thenReturn(List.of());

            assertDoesNotThrow(() -> washBayService.getCapacity(GARAGE_ID, null, STAFF_ID, "ROLE_ADMIN"));
        }

        @Test
        void cssSameGarage_succeeds() {
            stubReadPolicyAllow(STAFF_ID, "ROLE_STAFF");
            when(garageRepository.existsById(GARAGE_ID)).thenReturn(true);
            when(washBayRepository.countAvailableGroupedByVehicleType(GARAGE_ID)).thenReturn(List.of());

            assertDoesNotThrow(() -> washBayService.getCapacity(GARAGE_ID, null, STAFF_ID, "ROLE_STAFF"));
        }

        @Test
        void cssOtherGarage_throwsForbidden() {
            when(staffOperationAccessPolicy.requireCustomerServiceOrAdmin(STAFF_ID, "ROLE_STAFF"))
                    .thenReturn(cssProfile(GARAGE_ID));

            var ex = assertThrows(ResponseStatusException.class,
                    () -> washBayService.getCapacity(OTHER_GARAGE_ID, null, STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            verify(garageRepository, never()).existsById(anyLong());
        }

        @Test
        void vcs_throwsForbidden() {
            stubReadPolicyDeny(STAFF_ID, "ROLE_STAFF");

            var ex = assertThrows(ResponseStatusException.class,
                    () -> washBayService.getCapacity(GARAGE_ID, null, STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            verify(garageRepository, never()).existsById(anyLong());
        }
    }

    // ── updateStatus authorization ────────────────────────────────────────────

    @Nested
    class UpdateStatus {

        private WashBayStatusUpdateRequest availableRequest() {
            WashBayStatusUpdateRequest req = new WashBayStatusUpdateRequest();
            req.setStatus(WashBayStatus.AVAILABLE);
            return req;
        }

        private WashBay washBay() {
            Garage garage = TestFixtures.garage();
            garage.setId(GARAGE_ID);
            WashBay bay = TestFixtures.washBay(garage);
            return bay;
        }

        @Test
        void admin_succeeds() {
            WashBay bay = washBay();
            when(washBayRepository.findById(bay.getId())).thenReturn(Optional.of(bay));
            stubPolicyAllow(STAFF_ID, "ROLE_ADMIN", GARAGE_ID);
            when(washBayRepository.save(bay)).thenReturn(bay);

            WashBayResponse response = washBayService.updateStatus(bay.getId(), availableRequest(), STAFF_ID, "ROLE_ADMIN");

            assertNotNull(response);
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_ADMIN", GARAGE_ID);
            verify(washBayRepository).save(bay);
        }

        @Test
        void cssSameGarage_succeeds() {
            WashBay bay = washBay();
            when(washBayRepository.findById(bay.getId())).thenReturn(Optional.of(bay));
            stubPolicyAllow(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
            when(washBayRepository.save(bay)).thenReturn(bay);

            WashBayResponse response = washBayService.updateStatus(bay.getId(), availableRequest(), STAFF_ID, "ROLE_STAFF");

            assertNotNull(response);
            verify(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_STAFF", GARAGE_ID);
        }

        @Test
        void cssOtherGarage_throwsForbidden() {
            WashBay bay = washBay();
            when(washBayRepository.findById(bay.getId())).thenReturn(Optional.of(bay));
            stubPolicyDeny(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> washBayService.updateStatus(bay.getId(), availableRequest(), STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            verify(washBayRepository, never()).save(any());
        }

        @Test
        void vcs_throwsForbidden() {
            WashBay bay = washBay();
            when(washBayRepository.findById(bay.getId())).thenReturn(Optional.of(bay));
            stubPolicyDeny(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> washBayService.updateStatus(bay.getId(), availableRequest(), STAFF_ID, "ROLE_STAFF"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            verify(washBayRepository, never()).save(any());
        }

        @Test
        void unknownRole_throwsForbidden() {
            WashBay bay = washBay();
            when(washBayRepository.findById(bay.getId())).thenReturn(Optional.of(bay));
            doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"))
                    .when(staffOperationAccessPolicy).requireCustomerServiceOrAdminForGarage(STAFF_ID, "ROLE_UNKNOWN", GARAGE_ID);

            var ex = assertThrows(ResponseStatusException.class,
                    () -> washBayService.updateStatus(bay.getId(), availableRequest(), STAFF_ID, "ROLE_UNKNOWN"));
            assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
            verify(washBayRepository, never()).save(any());
        }

        @Test
        void policyFailure_saveNeverCalled() {
            WashBay bay = washBay();
            when(washBayRepository.findById(bay.getId())).thenReturn(Optional.of(bay));
            stubPolicyDeny(STAFF_ID, "ROLE_STAFF", GARAGE_ID);

            assertThrows(ResponseStatusException.class,
                    () -> washBayService.updateStatus(bay.getId(), availableRequest(), STAFF_ID, "ROLE_STAFF"));
            verify(washBayRepository, never()).save(any());
        }
    }
}
