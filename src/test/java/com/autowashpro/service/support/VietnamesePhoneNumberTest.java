package com.autowashpro.service.support;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class VietnamesePhoneNumberTest {

    @Test
    void normalizesLocalAndInternationalMobileNumbers() {
        assertEquals("+84912345678", VietnamesePhoneNumber.normalizeMobile("0912 345 678"));
        assertEquals("+84912345678", VietnamesePhoneNumber.normalizeMobile("+84 (912) 345-678"));
    }

    @Test
    void rejectsInvalidPrefixLengthAndCharacters() {
        assertBadRequest("0212345678");
        assertBadRequest("091234567");
        assertBadRequest("0912ABC678");
        assertBadRequest("+840912345678");
    }

    private void assertBadRequest(String phone) {
        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> VietnamesePhoneNumber.normalizeMobile(phone));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }
}
