package com.autowashpro.service;

import com.autowashpro.service.support.StoredImage;

public interface ImageStorageProvider {
    StoredImage upload(byte[] content, String folder);

    void delete(String publicId);
}
