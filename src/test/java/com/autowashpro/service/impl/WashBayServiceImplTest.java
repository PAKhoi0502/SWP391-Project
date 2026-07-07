package com.autowashpro.service.impl;

import com.autowashpro.dto.request.WashBayCreateRequest;
import com.autowashpro.dto.request.WashBayStatusUpdateRequest;
import com.autowashpro.dto.response.WashBayCapacityResponse;
import com.autowashpro.dto.response.WashBayResponse;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.WashBay;
import com.autowashpro.entity.enums.WashBayStatus;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WashBayServiceImplTest {

    @Mock
    private WashBayRepository washBayRepository;

    @Mock
    private GarageRepository garageRepository;

    @InjectMocks
    private WashBayServiceImpl washBayService;

    @Test
    void createNormalizesMotorbikeAndUsesAvailableStatus() {
        Garage garage = TestFixtures.garage();
        WashBayCreateRequest request = TestFixtures.washBayCreateRequest(garage);
        request.setVehicleType("MOTORBIKE");
        when(garageRepository.existsById(garage.getId())).thenReturn(true);
        when(washBayRepository.save(any(WashBay.class))).thenAnswer(invocation -> {
            WashBay bay = invocation.getArgument(0);
            bay.setId(1L);
            return bay;
        });

        WashBayResponse response = washBayService.create(request);

        assertEquals("BIKE", response.getVehicleType());
        assertEquals(WashBayStatus.AVAILABLE, response.getStatus());
    }

    @Test
    void createRejectsUnknownGarage() {
        WashBayCreateRequest request = TestFixtures.washBayCreateRequest(TestFixtures.garage());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> washBayService.create(request));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(washBayRepository, never()).save(any());
    }

    @Test
    void createRejectsDuplicateBayCodeWithinGarage() {
        Garage garage = TestFixtures.garage();
        WashBayCreateRequest request = TestFixtures.washBayCreateRequest(garage);
        when(garageRepository.existsById(garage.getId())).thenReturn(true);
        when(washBayRepository.existsByGarageIdAndBayCode(garage.getId(), request.getName()))
                .thenReturn(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> washBayService.create(request));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    void updateStatusDeactivatesInactiveBay() {
        WashBay bay = TestFixtures.washBay(TestFixtures.garage());
        WashBayStatusUpdateRequest request = new WashBayStatusUpdateRequest();
        request.setStatus(WashBayStatus.INACTIVE);
        when(washBayRepository.findById(bay.getId())).thenReturn(Optional.of(bay));
        when(washBayRepository.save(bay)).thenReturn(bay);

        WashBayResponse response = washBayService.updateStatus(bay.getId(), request);

        assertEquals(WashBayStatus.INACTIVE, response.getStatus());
        assertFalse(response.getIsActive());
    }

    @Test
    void getSupportedVehicleTypesRejectsMissingGarage() {
        when(garageRepository.existsById(99L)).thenReturn(false);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> washBayService.getSupportedVehicleTypes(99L));

        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    @Test
    void getCapacityReturnsRequestedVehicleTypeCount() {
        Garage garage = TestFixtures.garage();
        when(garageRepository.existsById(garage.getId())).thenReturn(true);
        when(washBayRepository.countAvailableByGarageAndVehicleType(garage.getId(), "CAR"))
                .thenReturn(3L);

        WashBayCapacityResponse response = washBayService.getCapacity(garage.getId(), "CAR");

        assertEquals(3L, response.getAvailableCountByVehicleType().get("CAR"));
    }

    @Test
    void getCapacityGroupsAllVehicleTypes() {
        Garage garage = TestFixtures.garage();
        when(garageRepository.existsById(garage.getId())).thenReturn(true);
        when(washBayRepository.countAvailableGroupedByVehicleType(garage.getId()))
                .thenReturn(List.of(new Object[]{"CAR", 2L}, new Object[]{"BIKE", 1L}));

        WashBayCapacityResponse response = washBayService.getCapacity(garage.getId(), null);

        assertEquals(2L, response.getAvailableCountByVehicleType().get("CAR"));
        assertEquals(1L, response.getAvailableCountByVehicleType().get("BIKE"));
    }
}
