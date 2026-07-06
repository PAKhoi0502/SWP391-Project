package com.autowashpro.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "upload")
public class UploadProperties {
    private long maxImageSizeBytes = 5_242_880L;
}
