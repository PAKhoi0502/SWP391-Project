package com.autowashpro.service.impl;

import com.autowashpro.dto.request.GarageCreateRequest;
import com.autowashpro.dto.request.GarageStatusUpdateRequest;
import com.autowashpro.dto.request.GarageUpdateRequest;
import com.autowashpro.dto.response.GarageCapabilitiesResponse;
import com.autowashpro.dto.response.GarageResponse;
import com.autowashpro.entity.Garage;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.WashBayRepository;
import com.autowashpro.support.TestFixtures;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
class GarageServiceImplTest {

    @Mock
    private GarageRepository garageRepository;

    @Mock
    private WashBayRepository washBayRepository;

    @InjectMocks
    private GarageServiceImpl garageService;

    @Test
    void createPersistsActiveGarage() {
        GarageCreateRequest request = TestFixtures.garageCreateRequest();
        when(garageRepository.save(any(Garage.class))).thenAnswer(invocation -> {
            Garage garage = invocation.getArgument(0);
            garage.setId(1L);
            return garage;
        });

        GarageResponse response = garageService.create(request);

        assertEquals(1L, response.getId());
        assertEquals(request.getGarageCode(), response.getGarageCode());
        assertTrue(response.getIsActive());
    }

    @Test
    void createRejectsDuplicateGarageCode() {
        GarageCreateRequest request = TestFixtures.garageCreateRequest();
        when(garageRepository.existsByGarageCode(request.getGarageCode())).thenReturn(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> garageService.create(request));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verify(garageRepository, never()).save(any());
    }

    @Test
    void createRejectsDuplicatePhone() {
        GarageCreateRequest request = TestFixtures.garageCreateRequest();
        when(garageRepository.existsByPhone(request.getPhone())).thenReturn(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> garageService.create(request));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    void getByIdReturnsNotFoundForMissingGarage() {
        when(garageRepository.findById(99L)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> garageService.getById(99L));

        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    @Test
    void updateOnlyChangesProvidedFields() {
        Garage garage = TestFixtures.garage();
        GarageUpdateRequest request = new GarageUpdateRequest();
        request.setName("Updated Garage");
        when(garageRepository.findById(garage.getId())).thenReturn(Optional.of(garage));
        when(garageRepository.save(garage)).thenReturn(garage);

        GarageResponse response = garageService.update(garage.getId(), request);

        assertEquals("Updated Garage", response.getName());
        assertEquals("TEST-GARAGE", response.getGarageCode());
    }

    @Test
    void updateStatusDeactivatesGarage() {
        Garage garage = TestFixtures.garage();
        GarageStatusUpdateRequest request = new GarageStatusUpdateRequest();
        request.setIsActive(false);
        when(garageRepository.findById(garage.getId())).thenReturn(Optional.of(garage));
        when(garageRepository.save(garage)).thenReturn(garage);

        GarageResponse response = garageService.updateStatus(garage.getId(), request);

        assertFalse(response.getIsActive());
    }

    @Test
    void getCapabilitiesReturnsSupportedVehicleTypes() {
        Garage garage = TestFixtures.garage();
        when(garageRepository.findById(garage.getId())).thenReturn(Optional.of(garage));
        when(washBayRepository.findDistinctVehicleTypesByGarageId(garage.getId()))
                .thenReturn(List.of("CAR", "BIKE"));

        GarageCapabilitiesResponse response = garageService.getCapabilities(garage.getId());

        assertEquals(List.of("CAR", "BIKE"), response.getSupportedVehicleTypes());
    }

    @Test
    void assertGarageIsActiveRejectsInactiveGarage() {
        Garage garage = TestFixtures.garage();
        garage.setIsActive(false);
        when(garageRepository.findById(garage.getId())).thenReturn(Optional.of(garage));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> garageService.assertGarageIsActive(garage.getId()));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }
}
