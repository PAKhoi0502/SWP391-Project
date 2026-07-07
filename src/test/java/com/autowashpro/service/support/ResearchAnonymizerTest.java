package com.autowashpro.service.support;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ResearchAnonymizerTest {

    private static final String SECRET = "test-research-anonymization-secret-32";

    @Test
    void generatesStableDomainSeparatedIdentifiers() {
        ResearchAnonymizer anonymizer = new ResearchAnonymizer(SECRET);

        String first = anonymizer.anonymizeCustomer(15L, null, 100L);
        String repeated = anonymizer.anonymizeCustomer(15L, null, 200L);
        String different = anonymizer.anonymizeCustomer(16L, null, 100L);
        String booking = anonymizer.anonymizeBooking(15L);

        assertEquals(first, repeated);
        assertNotEquals(first, different);
        assertNotEquals(first, booking);
        assertTrue(first.startsWith("customer_"));
        assertTrue(booking.startsWith("booking_"));
    }

    @Test
    void normalizesWalkInPhoneBeforeAnonymizing() {
        ResearchAnonymizer anonymizer = new ResearchAnonymizer(SECRET);

        assertEquals(
                anonymizer.anonymizeCustomer(null, "0901 234 567", 1L),
                anonymizer.anonymizeCustomer(null, "0901-234-567", 2L));
    }

    @Test
    void rejectsMissingOrWeakSecret() {
        ResearchAnonymizer anonymizer = new ResearchAnonymizer("short-secret");

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> anonymizer.anonymizeCustomer(1L, null, 1L));

        assertEquals(503, error.getStatusCode().value());
    }
}
