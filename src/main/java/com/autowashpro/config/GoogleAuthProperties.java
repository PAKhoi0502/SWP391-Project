package com.autowashpro.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "google")
public class GoogleAuthProperties {
    private String clientId;

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank();
    }
}
