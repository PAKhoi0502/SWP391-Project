package com.autowashpro.service.impl;

import com.autowashpro.dto.request.VehicleCreateRequest;
import com.autowashpro.dto.request.VehicleStatusUpdateRequest;
import com.autowashpro.dto.request.VehicleUpdateRequest;
import com.autowashpro.dto.response.VehicleResponse;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.repository.VehicleRepository;
import com.autowashpro.support.TestFixtures;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VehicleServiceImplTest {

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private VehicleServiceImpl vehicleService;

    @Test
    void createNormalizesPlateAndMakesFirstVehicleDefault() {
        User customer = TestFixtures.customer();
        VehicleCreateRequest request = TestFixtures.vehicleCreateRequest();
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(vehicleRepository.findByCustomer_IdAndIsActiveTrue(customer.getId())).thenReturn(List.of());
        when(vehicleRepository.save(any(Vehicle.class))).thenAnswer(invocation -> {
            Vehicle vehicle = invocation.getArgument(0);
            vehicle.setId(1L);
            return vehicle;
        });

        VehicleResponse response = vehicleService.create(request, customer.getId());

        assertEquals("51H12345", response.getNormalizedLicensePlate());
        assertTrue(response.getIsDefault());
        verify(vehicleRepository).clearDefaultByCustomerId(customer.getId());
    }

    @Test
    void createKeepsAdditionalVehicleNonDefault() {
        User customer = TestFixtures.customer();
        VehicleCreateRequest request = TestFixtures.vehicleCreateRequest();
        request.setRawLicensePlate("59X3-246.80");
        request.setIsDefault(false);
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(vehicleRepository.findByCustomer_IdAndIsActiveTrue(customer.getId()))
                .thenReturn(List.of(TestFixtures.car(customer)));
        when(vehicleRepository.save(any(Vehicle.class))).thenAnswer(invocation -> invocation.getArgument(0));

        VehicleResponse response = vehicleService.create(request, customer.getId());

        assertFalse(response.getIsDefault());
        verify(vehicleRepository, never()).clearDefaultByCustomerId(customer.getId());
    }

    @Test
    void createRejectsDuplicateNormalizedPlate() {
        User customer = TestFixtures.customer();
        VehicleCreateRequest request = TestFixtures.vehicleCreateRequest();
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(vehicleRepository.existsByNormalizedLicensePlateAndIsActiveTrue("51H12345"))
                .thenReturn(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> vehicleService.create(request, customer.getId()));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verify(vehicleRepository, never()).save(any());
    }

    @Test
    void getOwnByIdRejectsVehicleOwnedByAnotherCustomer() {
        when(vehicleRepository.findByIdAndCustomer_Id(5L, 1L)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> vehicleService.getOwnById(5L, 1L));

        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    @Test
    void setDefaultRejectsInactiveVehicle() {
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        vehicle.setIsActive(false);
        when(vehicleRepository.findByIdAndCustomer_Id(vehicle.getId(), vehicle.getCustomer().getId()))
                .thenReturn(Optional.of(vehicle));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> vehicleService.setDefault(vehicle.getId(), vehicle.getCustomer().getId()));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(vehicleRepository, never()).clearDefaultByCustomerId(any());
    }

    @Test
    void setDefaultClearsPreviousDefault() {
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        vehicle.setIsDefault(false);
        when(vehicleRepository.findByIdAndCustomer_Id(vehicle.getId(), vehicle.getCustomer().getId()))
                .thenReturn(Optional.of(vehicle));
        when(vehicleRepository.save(vehicle)).thenReturn(vehicle);

        VehicleResponse response = vehicleService.setDefault(vehicle.getId(), vehicle.getCustomer().getId());

        assertTrue(response.getIsDefault());
        verify(vehicleRepository).clearDefaultByCustomerId(vehicle.getCustomer().getId());
    }

    @Test
    void deactivatingDefaultVehicleClearsDefaultFlag() {
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        VehicleStatusUpdateRequest request = new VehicleStatusUpdateRequest();
        request.setIsActive(false);
        when(vehicleRepository.findByIdAndCustomer_Id(vehicle.getId(), vehicle.getCustomer().getId()))
                .thenReturn(Optional.of(vehicle));
        when(vehicleRepository.save(vehicle)).thenReturn(vehicle);

        VehicleResponse response = vehicleService.updateStatus(
                vehicle.getId(), request, vehicle.getCustomer().getId());

        assertFalse(response.getIsActive());
        assertFalse(response.getIsDefault());
    }

    @Test
    void updateChangesOnlyProvidedVehicleFields() {
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        VehicleUpdateRequest request = new VehicleUpdateRequest();
        request.setColor("Black");
        when(vehicleRepository.findByIdAndCustomer_Id(vehicle.getId(), vehicle.getCustomer().getId()))
                .thenReturn(Optional.of(vehicle));
        when(vehicleRepository.save(vehicle)).thenReturn(vehicle);

        VehicleResponse response = vehicleService.update(
                vehicle.getId(), request, vehicle.getCustomer().getId());

        assertEquals("Black", response.getColor());
        assertEquals("Toyota", response.getBrand());
    }

    @Test
    void listOwnReturnsOnlyRepositoryOwnedActiveVehicles() {
        User customer = TestFixtures.customer();
        when(vehicleRepository.findByCustomer_IdAndIsActiveTrue(customer.getId()))
                .thenReturn(List.of(TestFixtures.car(customer)));

        List<VehicleResponse> responses = vehicleService.listOwn(customer.getId());

        assertEquals(1, responses.size());
        assertEquals(customer.getId(), responses.get(0).getCustomerId());
    }
}
