package com.autowashpro.service.support;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.HexFormat;

@Component
public class ResearchAnonymizer {

    private final String secret;

    public ResearchAnonymizer(@Value("${research.anonymization-secret:}") String secret) {
        this.secret = secret;
    }

    public String anonymizeCustomer(Long customerId, String guestPhone, Long bookingId) {
        if (customerId != null) {
            return "customer_" + digest("registered-customer:" + customerId);
        }
        String normalizedPhone = normalizePhone(guestPhone);
        if (!normalizedPhone.isBlank()) {
            return "customer_" + digest("walk-in-phone:" + normalizedPhone);
        }
        return "customer_" + digest("walk-in-booking:" + bookingId);
    }

    public String anonymizeBooking(Long bookingId) {
        return "booking_" + digest("booking:" + bookingId);
    }

    private String digest(String value) {
        validateSecret();
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8))).substring(0, 32);
        } catch (GeneralSecurityException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to anonymize research data");
        }
    }

    private void validateSecret() {
        if (secret == null || secret.length() < 32) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Research export anonymization is not configured");
        }
    }

    private String normalizePhone(String phone) {
        return phone == null ? "" : phone.replaceAll("[^0-9]", "");
    }
}
