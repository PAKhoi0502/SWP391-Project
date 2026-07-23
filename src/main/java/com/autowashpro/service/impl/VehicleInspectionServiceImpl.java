package com.autowashpro.service.impl;

import com.autowashpro.dto.request.VehicleInspectionCreateRequest;
import com.autowashpro.dto.request.VehicleInspectionUpdateRequest;
import com.autowashpro.dto.response.VehicleInspectionImageResponse;
import com.autowashpro.dto.response.VehicleInspectionResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.BookingServiceStep;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.Upload;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.entity.VehicleInspection;
import com.autowashpro.entity.VehicleInspectionImage;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.BookingServiceStepRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.repository.VehicleInspectionImageRepository;
import com.autowashpro.repository.VehicleInspectionRepository;
import com.autowashpro.repository.VehicleRepository;
import com.autowashpro.service.UploadService;
import com.autowashpro.service.VehicleInspectionService;
import com.autowashpro.service.support.InspectionAccessPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class VehicleInspectionServiceImpl implements VehicleInspectionService {

    private static final List<String> VALID_TYPES = List.of("BEFORE_WASH", "AFTER_WASH");

    private final VehicleInspectionRepository inspectionRepository;
    private final VehicleInspectionImageRepository imageRepository;
    private final BookingRepository bookingRepository;
    private final BookingServiceStepRepository bookingServiceStepRepository;
    private final VehicleRepository vehicleRepository;
    private final GarageRepository garageRepository;
    private final UserRepository userRepository;
    private final UploadService uploadService;
    private final InspectionAccessPolicy inspectionAccessPolicy;

    @Override
    @Transactional
    public VehicleInspectionResponse create(
            Long bookingId,
            VehicleInspectionCreateRequest request,
            Long currentUserId,
            String role) {

        if (!VALID_TYPES.contains(request.getInspectionType())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid inspection type: " + request.getInspectionType()
                            + ". Must be BEFORE_WASH or AFTER_WASH");
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Booking not found: " + bookingId));

        inspectionAccessPolicy.requireCanManage(booking, currentUserId, role);

        VehicleInspection inspection = new VehicleInspection();
        inspection.setBookingId(bookingId);
        inspection.setVehicleId(booking.getVehicleId());
        inspection.setGarageId(booking.getGarageId());
        inspection.setInspectedByStaffId(currentUserId);
        inspection.setType(request.getInspectionType());
        inspection.setExteriorCondition(request.getExteriorCondition());
        inspection.setInteriorCondition(request.getInteriorCondition());
        inspection.setNotes(request.getNotes());

        VehicleInspection saved = inspectionRepository.save(inspection);
        List<Upload> managedUploads = uploadService.requireInspectionUploads(
                bookingId,
                request.getImagePublicIds(),
                null);

        List<VehicleInspectionImage> savedImages = new ArrayList<>();
        for (Upload upload : managedUploads) {
            VehicleInspectionImage image = new VehicleInspectionImage();
            image.setVehicleInspectionId(saved.getId());
            image.setImageUrl(upload.getFileUrl());
            image.setPublicId(upload.getPublicId());
            savedImages.add(imageRepository.save(image));
        }

        // BEFORE_WASH inspection is the source of truth for intake.
        // Auto-complete any pending INTAKE_INSPECTION booking steps (idempotent).
        if ("BEFORE_WASH".equals(request.getInspectionType())) {
            autoCompleteIntakeSteps(bookingId, currentUserId);
        }

        return toResponse(saved, savedImages);
    }

    @Override
    public List<VehicleInspectionResponse> listByBooking(
            Long bookingId,
            Long currentUserId,
            String role) {

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Booking not found: " + bookingId));

        inspectionAccessPolicy.requireCanRead(booking, currentUserId, role);

        return inspectionRepository.findByBookingIdOrderByCreatedAtAsc(bookingId)
                .stream()
                .map(inspection -> toResponse(
                        inspection,
                        imageRepository.findByVehicleInspectionId(inspection.getId())))
                .collect(Collectors.toList());
    }

    @Override
    public VehicleInspectionResponse getById(Long id, Long currentUserId, String role) {
        VehicleInspection inspection = inspectionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Inspection not found: " + id));

        Booking booking = bookingRepository.findById(inspection.getBookingId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        inspectionAccessPolicy.requireCanRead(booking, currentUserId, role);

        return toResponse(inspection, imageRepository.findByVehicleInspectionId(id));
    }

    @Override
    @Transactional
    public VehicleInspectionResponse update(
            Long id,
            VehicleInspectionUpdateRequest request,
            Long currentUserId,
            String role) {

        VehicleInspection inspection = inspectionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Inspection not found: " + id));

        Booking booking = bookingRepository.findById(inspection.getBookingId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        inspectionAccessPolicy.requireCanManage(booking, currentUserId, role);

        if (request.getNotes() != null) {
            inspection.setNotes(request.getNotes());
        }
        if (request.getExteriorCondition() != null) {
            inspection.setExteriorCondition(request.getExteriorCondition());
        }
        if (request.getInteriorCondition() != null) {
            inspection.setInteriorCondition(request.getInteriorCondition());
        }

        VehicleInspection updated = inspectionRepository.save(inspection);
        List<VehicleInspectionImage> images;

        if (request.getImagePublicIds() != null) {
            List<Upload> managedUploads = uploadService.requireInspectionUploads(
                    inspection.getBookingId(),
                    request.getImagePublicIds(),
                    id);

            imageRepository.deleteAll(imageRepository.findByVehicleInspectionId(id));
            imageRepository.flush();

            images = new ArrayList<>();
            for (Upload upload : managedUploads) {
                VehicleInspectionImage image = new VehicleInspectionImage();
                image.setVehicleInspectionId(id);
                image.setImageUrl(upload.getFileUrl());
                image.setPublicId(upload.getPublicId());
                images.add(imageRepository.save(image));
            }
        } else {
            images = imageRepository.findByVehicleInspectionId(id);
        }

        // Force updatedAt to refresh even when no content fields changed.
        // This is required for AFTER_WASH stale detection (updatedAt vs careCompletedAt).
        inspectionRepository.touchUpdatedAt(id, LocalDateTime.now());

        // BEFORE_WASH update: re-complete INTAKE_INSPECTION steps in case they exist (idempotent).
        if ("BEFORE_WASH".equals(updated.getType())) {
            autoCompleteIntakeSteps(updated.getBookingId(), currentUserId);
        }

        return toResponse(updated, images);
    }

    /**
     * Idempotently completes all pending INTAKE_INSPECTION booking service steps.
     * Called when a BEFORE_WASH inspection is created or updated, since BEFORE_WASH
     * is the authoritative intake record — no separate step tick is needed.
     * Safe to call multiple times; already-completed steps are left unchanged.
     */
    private void autoCompleteIntakeSteps(Long bookingId, Long staffUserId) {
        LocalDateTime now = LocalDateTime.now();
        bookingServiceStepRepository.findByBookingIdOrderByStepOrder(bookingId).stream()
                .filter(s -> "INTAKE_INSPECTION".equalsIgnoreCase(s.getExecutionPhase()))
                .filter(s -> !"COMPLETED".equals(s.getStatus()))
                .forEach(s -> {
                    s.setStatus("COMPLETED");
                    s.setCompletedAt(now);
                    s.setCompletedByStaffId(staffUserId);
                    bookingServiceStepRepository.save(s);
                });
    }

    private VehicleInspectionResponse toResponse(
            VehicleInspection inspection,
            List<VehicleInspectionImage> images) {

        return VehicleInspectionResponse.builder()
                .id(inspection.getId())
                .bookingId(inspection.getBookingId())
                .vehicleId(inspection.getVehicleId())
                .vehicleName(getVehicleName(inspection.getVehicleId()))
                .garageId(inspection.getGarageId())
                .garageName(getGarageName(inspection.getGarageId()))
                .inspectedByStaffId(inspection.getInspectedByStaffId())
                .inspectedByStaffName(getUserName(inspection.getInspectedByStaffId()))
                .type(inspection.getType())
                .exteriorCondition(inspection.getExteriorCondition())
                .interiorCondition(inspection.getInteriorCondition())
                .notes(inspection.getNotes())
                .images(images.stream()
                        .map(image -> VehicleInspectionImageResponse.builder()
                                .id(image.getId())
                                .imageUrl(image.getImageUrl())
                                .publicId(image.getPublicId())
                                .build())
                        .collect(Collectors.toList()))
                .createdAt(inspection.getCreatedAt())
                .updatedAt(inspection.getUpdatedAt())
                .build();
    }

    private String getVehicleName(Long vehicleId) {
        if (vehicleId == null) {
            return null;
        }

        return vehicleRepository.findById(vehicleId)
                .map(this::formatVehicleName)
                .orElse(null);
    }

    private String formatVehicleName(Vehicle vehicle) {
        String licensePlate = vehicle.getRawLicensePlate();
        String brandModel = Stream.of(vehicle.getBrand(), vehicle.getModel())
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.joining(" "));

        if (licensePlate != null && !licensePlate.isBlank() && !brandModel.isBlank()) {
            return licensePlate + " - " + brandModel;
        }
        if (licensePlate != null && !licensePlate.isBlank()) {
            return licensePlate;
        }
        return brandModel;
    }

    private String getGarageName(Long garageId) {
        if (garageId == null) {
            return null;
        }

        return garageRepository.findById(garageId)
                .map(Garage::getName)
                .orElse(null);
    }

    private String getUserName(Long userId) {
        if (userId == null) {
            return null;
        }

        return userRepository.findById(userId)
                .map(User::getFullName)
                .orElse(null);
    }
}
