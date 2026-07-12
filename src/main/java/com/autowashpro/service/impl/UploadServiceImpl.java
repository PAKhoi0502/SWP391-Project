package com.autowashpro.service.impl;

import com.autowashpro.common.UploadFolder;
import com.autowashpro.dto.response.UploadImageResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.Upload;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.entity.VehicleInspectionImage;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.UploadRepository;
import com.autowashpro.repository.VehicleInspectionImageRepository;
import com.autowashpro.repository.VehicleRepository;
import com.autowashpro.service.ImageStorageProvider;
import com.autowashpro.service.UploadService;
import com.autowashpro.service.support.ImageFileValidator;
import com.autowashpro.service.support.InspectionAccessPolicy;
import com.autowashpro.service.support.StoredImage;
import com.autowashpro.service.support.ValidatedImage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class UploadServiceImpl implements UploadService {

    private final UploadRepository uploadRepository;
    private final BookingRepository bookingRepository;
    private final VehicleRepository vehicleRepository;
    private final VehicleInspectionImageRepository inspectionImageRepository;
    private final ImageStorageProvider storageProvider;
    private final ImageFileValidator imageFileValidator;
    private final InspectionAccessPolicy inspectionAccessPolicy;
    private final PlatformTransactionManager transactionManager;

    @Override
    public UploadImageResponse uploadImage(
            MultipartFile file,
            String folderValue,
            Long requestedEntityId,
            Long currentUserId,
            String role) {

        UploadFolder folder = UploadFolder.fromValue(folderValue);
        Long entityId = resolveEntityId(folder, requestedEntityId, currentUserId, role);
        ValidatedImage image = imageFileValidator.validate(file);
        StoredImage storedImage = storageProvider.upload(image.content(), folder.getStorageFolder());

        PersistedUpload persisted;
        try {
            persisted = new TransactionTemplate(transactionManager).execute(status ->
                    persistUpload(folder, entityId, currentUserId, image, storedImage));
        } catch (RuntimeException exception) {
            cleanupNewImage(storedImage.publicId(), exception);
            throw exception;
        }

        if (persisted == null) {
            ResponseStatusException exception = new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Upload metadata could not be saved");
            cleanupNewImage(storedImage.publicId(), exception);
            throw exception;
        }

        cleanupReplacedImage(persisted.replacedPublicId());

        return UploadImageResponse.builder()
                .imageUrl(persisted.upload().getFileUrl())
                .publicId(persisted.upload().getPublicId())
                .folder(folder.getValue())
                .build();
    }

    @Override
    public void deleteImage(String publicId, Long currentUserId, String role) {
        Upload upload = uploadRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Uploaded image not found"));

        requireDeletePermission(upload, currentUserId, role);

        if (inspectionImageRepository.findByPublicId(publicId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Image is linked to a vehicle inspection");
        }

        storageProvider.delete(publicId);

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            uploadRepository.delete(upload);
            uploadRepository.flush();
        });
    }

    @Override
    public List<Upload> requireInspectionUploads(
            Long bookingId,
            List<String> publicIds,
            Long currentInspectionId) {

        if (publicIds == null || publicIds.isEmpty()) {
            return List.of();
        }

        Set<String> uniqueIds = new HashSet<>();
        List<Upload> uploads = new ArrayList<>();

        for (String publicId : publicIds) {
            if (publicId == null || publicId.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "imagePublicIds must not contain blank values");
            }
            if (!uniqueIds.add(publicId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "imagePublicIds must not contain duplicates");
            }

            Upload upload = uploadRepository.findByPublicId(publicId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Inspection image is not managed by the server"));

            if (!UploadFolder.INSPECTIONS.getEntityType().equals(upload.getEntityType())
                    || !bookingId.equals(upload.getEntityId())) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Inspection image does not belong to this booking");
            }

            VehicleInspectionImage linkedImage = inspectionImageRepository.findByPublicId(publicId).orElse(null);
            if (linkedImage != null
                    && (currentInspectionId == null
                    || !currentInspectionId.equals(linkedImage.getVehicleInspectionId()))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Inspection image is already linked");
            }

            uploads.add(upload);
        }

        return uploads;
    }

    private Long resolveEntityId(
            UploadFolder folder,
            Long requestedEntityId,
            Long currentUserId,
            String role) {

        if (folder == UploadFolder.AVATARS) {
            if (requestedEntityId != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "entity_id must be omitted for avatars");
            }
            return currentUserId;
        }

        if (requestedEntityId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "entity_id is required for " + folder.getValue());
        }

        if (folder == UploadFolder.VEHICLES) {
            vehicleRepository.findByIdAndCustomer_Id(requestedEntityId, currentUserId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND, "Vehicle not found or not owned by current user"));
            return requestedEntityId;
        }

        Booking booking = bookingRepository.findById(requestedEntityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        inspectionAccessPolicy.requireCanManage(booking, currentUserId, role);
        return requestedEntityId;
    }

    private PersistedUpload persistUpload(
            UploadFolder folder,
            Long entityId,
            Long currentUserId,
            ValidatedImage image,
            StoredImage storedImage) {

        Upload upload;
        String replacedPublicId = null;

        if (folder == UploadFolder.AVATARS || folder == UploadFolder.VEHICLES) {
            upload = uploadRepository
                    .findFirstByOwnerIdAndEntityTypeAndEntityIdOrderByCreatedAtDesc(
                            currentUserId,
                            folder.getEntityType(),
                            entityId)
                    .orElseGet(Upload::new);
            replacedPublicId = upload.getPublicId();
        } else {
            upload = new Upload();
        }

        upload.setOwnerId(currentUserId);
        upload.setEntityType(folder.getEntityType());
        upload.setEntityId(entityId);
        upload.setFileUrl(storedImage.imageUrl());
        upload.setPublicId(storedImage.publicId());
        upload.setMimeType(image.mimeType());
        upload.setSize((long) image.content().length);

        Upload saved = uploadRepository.saveAndFlush(upload);
        return new PersistedUpload(saved, replacedPublicId);
    }

    private void requireDeletePermission(Upload upload, Long currentUserId, String role) {
        if (isAdmin(role)) {
            return;
        }

        if (UploadFolder.AVATARS.getEntityType().equals(upload.getEntityType())) {
            if (!currentUserId.equals(upload.getOwnerId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot delete another user's avatar");
            }
            return;
        }

        if (UploadFolder.INSPECTIONS.getEntityType().equals(upload.getEntityType())) {
            Booking booking = bookingRepository.findById(upload.getEntityId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
            inspectionAccessPolicy.requireCanManage(booking, currentUserId, role);
            return;
        }

        if (UploadFolder.VEHICLES.getEntityType().equals(upload.getEntityType())) {
            Vehicle vehicle = vehicleRepository.findById(upload.getEntityId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found"));
            if (vehicle.getCustomer() == null || !currentUserId.equals(vehicle.getCustomer().getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot delete another user's vehicle photo");
            }
            return;
        }

        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Uploaded image cannot be managed");
    }

    private boolean isAdmin(String role) {
        return "ADMIN".equalsIgnoreCase(role) || "ROLE_ADMIN".equalsIgnoreCase(role);
    }

    private void cleanupNewImage(String publicId, RuntimeException originalException) {
        try {
            storageProvider.delete(publicId);
        } catch (RuntimeException cleanupException) {
            originalException.addSuppressed(cleanupException);
        }
    }

    private void cleanupReplacedImage(String publicId) {
        if (publicId == null || publicId.isBlank()) {
            return;
        }

        try {
            storageProvider.delete(publicId);
        } catch (RuntimeException exception) {
            log.warn("Could not delete replaced image from image storage");
        }
    }

    private record PersistedUpload(Upload upload, String replacedPublicId) {
    }
}
