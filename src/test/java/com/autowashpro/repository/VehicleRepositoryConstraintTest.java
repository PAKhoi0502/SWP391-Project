package com.autowashpro.repository;

import com.autowashpro.entity.Vehicle;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

@DataJpaTest
@ActiveProfiles("test")
class VehicleRepositoryConstraintTest {

    @Autowired
    private VehicleRepository vehicleRepository;

    @Test
    void allowsSameNormalizedPlateForDifferentVehicleTypes() {
        vehicleRepository.saveAndFlush(vehicle("CAR"));

        assertDoesNotThrow(() -> vehicleRepository.saveAndFlush(vehicle("BIKE")));
    }

    @Test
    void rejectsSameNormalizedPlateForSameVehicleType() {
        vehicleRepository.saveAndFlush(vehicle("CAR"));

        assertThrows(
                DataIntegrityViolationException.class,
                () -> vehicleRepository.saveAndFlush(vehicle("CAR")));
    }

    private Vehicle vehicle(String vehicleType) {
        Vehicle vehicle = new Vehicle();
        vehicle.setRawLicensePlate("51G-123.45");
        vehicle.setNormalizedLicensePlate("51G12345");
        vehicle.setVehicleType(vehicleType);
        vehicle.setBrand("Test");
        vehicle.setModel("Test");
        vehicle.setIsDefault(false);
        vehicle.setIsActive(true);
        return vehicle;
    }
}
