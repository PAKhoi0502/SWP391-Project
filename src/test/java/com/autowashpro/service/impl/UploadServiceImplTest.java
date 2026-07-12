package com.autowashpro.service.impl;

import com.autowashpro.dto.response.UploadImageResponse;
import com.autowashpro.entity.Upload;
import com.autowashpro.entity.VehicleInspectionImage;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.UploadRepository;
import com.autowashpro.repository.VehicleInspectionImageRepository;
import com.autowashpro.repository.VehicleRepository;
import com.autowashpro.service.ImageStorageProvider;
import com.autowashpro.service.support.ImageFileValidator;
import com.autowashpro.service.support.InspectionAccessPolicy;
import com.autowashpro.service.support.StoredImage;
import com.autowashpro.service.support.ValidatedImage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UploadServiceImplTest {

    @Mock
    private UploadRepository uploadRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private VehicleInspectionImageRepository inspectionImageRepository;

    @Mock
    private ImageStorageProvider storageProvider;

    @Mock
    private ImageFileValidator imageFileValidator;

    @Mock
    private InspectionAccessPolicy inspectionAccessPolicy;

    @Mock
    private PlatformTransactionManager transactionManager;

    @Mock
    private TransactionStatus transactionStatus;

    private UploadServiceImpl uploadService;
    private MockMultipartFile file;

    @BeforeEach
    void setUp() {
        uploadService = new UploadServiceImpl(
                uploadRepository,
                bookingRepository,
                vehicleRepository,
                inspectionImageRepository,
                storageProvider,
                imageFileValidator,
                inspectionAccessPolicy,
                transactionManager);
        file = new MockMultipartFile("file", "avatar.jpg", "image/jpeg", new byte[]{1, 2, 3});
        lenient().when(transactionManager.getTransaction(any(TransactionDefinition.class))).thenReturn(transactionStatus);
    }

    @Test
    void uploadsAvatarAndStoresDetectedMetadata() {
        ValidatedImage validated = new ValidatedImage(new byte[]{1, 2, 3}, "image/jpeg");
        StoredImage stored = new StoredImage(
                "https://images.test/avatar.jpg",
                "autowashpro/avatars/avatar-1");
        when(imageFileValidator.validate(file)).thenReturn(validated);
        when(storageProvider.upload(validated.content(), "autowashpro/avatars")).thenReturn(stored);
        when(uploadRepository.findFirstByOwnerIdAndEntityTypeAndEntityIdOrderByCreatedAtDesc(
                1L, "AVATAR", 1L)).thenReturn(Optional.empty());
        when(uploadRepository.saveAndFlush(any(Upload.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UploadImageResponse response = uploadService.uploadImage(
                file, "avatars", null, 1L, "ROLE_CUSTOMER");

        assertEquals(stored.imageUrl(), response.getImageUrl());
        assertEquals(stored.publicId(), response.getPublicId());
        verify(transactionManager).commit(transactionStatus);
    }

    @Test
    void cleansCloudinaryImageWhenDatabaseSaveFails() {
        ValidatedImage validated = new ValidatedImage(new byte[]{1}, "image/jpeg");
        StoredImage stored = new StoredImage("https://images.test/a.jpg", "avatars/a");
        when(imageFileValidator.validate(file)).thenReturn(validated);
        when(storageProvider.upload(validated.content(), "autowashpro/avatars")).thenReturn(stored);
        when(uploadRepository.findFirstByOwnerIdAndEntityTypeAndEntityIdOrderByCreatedAtDesc(
                1L, "AVATAR", 1L)).thenReturn(Optional.empty());
        when(uploadRepository.saveAndFlush(any(Upload.class))).thenThrow(new RuntimeException("database failed"));

        assertThrows(RuntimeException.class,
                () -> uploadService.uploadImage(file, "avatars", null, 1L, "ROLE_CUSTOMER"));

        verify(storageProvider).delete(stored.publicId());
    }

    @Test
    void cleansCloudinaryImageWhenDatabaseCommitFails() {
        ValidatedImage validated = new ValidatedImage(new byte[]{1}, "image/jpeg");
        StoredImage stored = new StoredImage("https://images.test/a.jpg", "avatars/a");
        when(imageFileValidator.validate(file)).thenReturn(validated);
        when(storageProvider.upload(validated.content(), "autowashpro/avatars")).thenReturn(stored);
        when(uploadRepository.findFirstByOwnerIdAndEntityTypeAndEntityIdOrderByCreatedAtDesc(
                1L, "AVATAR", 1L)).thenReturn(Optional.empty());
        when(uploadRepository.saveAndFlush(any(Upload.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new RuntimeException("commit failed")).when(transactionManager).commit(transactionStatus);

        assertThrows(RuntimeException.class,
                () -> uploadService.uploadImage(file, "avatars", null, 1L, "ROLE_CUSTOMER"));

        verify(storageProvider).delete(stored.publicId());
    }

    @Test
    void rejectsAvatarEntityIdAndInvalidFolderBeforeStorageCall() {
        assertThrows(ResponseStatusException.class,
                () -> uploadService.uploadImage(file, "avatars", 99L, 1L, "ROLE_CUSTOMER"));
        assertThrows(ResponseStatusException.class,
                () -> uploadService.uploadImage(file, "other", null, 1L, "ROLE_CUSTOMER"));

        verify(storageProvider, never()).upload(any(), any());
    }

    @Test
    void ownerDeletesAvatarAndAdminDeletesAnyUnlinkedUpload() {
        Upload avatar = upload(1L, "AVATAR", 1L, "avatars/a");
        Upload inspection = upload(2L, "INSPECTION", 30L, "inspections/a");
        when(uploadRepository.findByPublicId("avatars/a")).thenReturn(Optional.of(avatar));
        when(uploadRepository.findByPublicId("inspections/a")).thenReturn(Optional.of(inspection));
        when(inspectionImageRepository.findByPublicId(any())).thenReturn(Optional.empty());

        uploadService.deleteImage("avatars/a", 1L, "ROLE_CUSTOMER");
        uploadService.deleteImage("inspections/a", 9L, "ROLE_ADMIN");

        verify(storageProvider).delete("avatars/a");
        verify(storageProvider).delete("inspections/a");
        verify(uploadRepository).delete(avatar);
        verify(uploadRepository).delete(inspection);
    }

    @Test
    void rejectsDeleteByAnotherUserAndLinkedInspectionDelete() {
        Upload avatar = upload(1L, "AVATAR", 1L, "avatars/a");
        Upload inspection = upload(2L, "INSPECTION", 30L, "inspections/a");
        VehicleInspectionImage linked = new VehicleInspectionImage();
        when(uploadRepository.findByPublicId("avatars/a")).thenReturn(Optional.of(avatar));
        when(uploadRepository.findByPublicId("inspections/a")).thenReturn(Optional.of(inspection));
        when(inspectionImageRepository.findByPublicId("inspections/a")).thenReturn(Optional.of(linked));

        assertThrows(ResponseStatusException.class,
                () -> uploadService.deleteImage("avatars/a", 8L, "ROLE_CUSTOMER"));
        assertThrows(ResponseStatusException.class,
                () -> uploadService.deleteImage("inspections/a", 9L, "ROLE_ADMIN"));

        verify(storageProvider, never()).delete(any());
    }

    @Test
    void resolvesOnlyManagedImagesFromTheSameBooking() {
        Upload first = upload(2L, "INSPECTION", 30L, "inspections/one");
        Upload second = upload(2L, "INSPECTION", 30L, "inspections/two");
        when(uploadRepository.findByPublicId(first.getPublicId())).thenReturn(Optional.of(first));
        when(uploadRepository.findByPublicId(second.getPublicId())).thenReturn(Optional.of(second));
        when(inspectionImageRepository.findByPublicId(any())).thenReturn(Optional.empty());

        List<Upload> resolved = uploadService.requireInspectionUploads(
                30L,
                List.of(first.getPublicId(), second.getPublicId()),
                null);

        assertEquals(List.of(first, second), resolved);
    }

    private Upload upload(Long ownerId, String type, Long entityId, String publicId) {
        Upload upload = new Upload();
        upload.setOwnerId(ownerId);
        upload.setEntityType(type);
        upload.setEntityId(entityId);
        upload.setPublicId(publicId);
        upload.setFileUrl("https://images.test/" + publicId);
        return upload;
    }
}
