package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UploadImageResponse {
    private String imageUrl;
    private String publicId;
    private String folder;
}
