package com.autowashpro.service.support;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class VietnameseLicensePlateTest {

    @Test
    void normalizesEquivalentCarInputs() {
        assertEquals("51G12345", VietnameseLicensePlate.normalizeAndValidate("51G-123.45", "CAR"));
        assertEquals("51G12345", VietnameseLicensePlate.normalizeAndValidate("51g 12345", "CAR"));
        assertEquals("51G12345", VietnameseLicensePlate.normalizeAndValidate("51G123.45", "CAR"));
    }

    @Test
    void acceptsCurrentAndLegacyMotorbikePlates() {
        assertEquals("59X312345", VietnameseLicensePlate.normalizeAndValidate("59X3-123.45", "BIKE"));
        assertEquals("59X1234", VietnameseLicensePlate.normalizeAndValidate("59X-1234", "BIKE"));
        assertEquals("59X11234", VietnameseLicensePlate.normalizeAndValidate("59X1-1234", "BIKE"));
    }

    @Test
    void rejectsUnsupportedCharactersAndWrongStructures() {
        assertBadRequest("51G@123.45", "CAR");
        assertBadRequest("12345678", "CAR");
        assertBadRequest("51G-1234", "CAR");
        assertBadRequest("51G-123.45", "TRUCK");
    }

    private void assertBadRequest(String plate, String vehicleType) {
        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> VietnameseLicensePlate.normalizeAndValidate(plate, vehicleType));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }
}
